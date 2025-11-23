const express = require('express');
const cors = require('cors');
const multer = require('multer');
const path = require('path');
const { spawn } = require('child_process');
const fs = require('fs');

// Simple logging utility
const logger = {
  info: (message, data = '') => {
    const timestamp = new Date().toISOString();
    console.log(`[INFO] ${timestamp} - ${message}`, data ? '\n' + JSON.stringify(data, null, 2) : '');
  },
  debug: (message, data = '') => {
    const timestamp = new Date().toISOString();
    console.log(`[DEBUG] ${timestamp} - ${message}`, data ? '\n' + JSON.stringify(data, null, 2) : '');
  },
  error: (message, error = '') => {
    const timestamp = new Date().toISOString();
    console.error(`[ERROR] ${timestamp} - ${message}`, error ? '\n' + error : '');
  }
};

const app = express();
const port = 5001;

// Define project directories
const uiRoot = __dirname;
const projectRoot = path.join(__dirname, '../loan_approval_project');
const dataDir = path.join(projectRoot, 'data');
const reportsDir = path.join(projectRoot, 'reports');

// Middleware
app.use(cors());
app.use(express.json());

// Serve static files from both the reports directory and the UI public directory
app.use('/reports', express.static(reportsDir));
app.use(express.static(path.join(uiRoot, 'public')));

// Log all requests
app.use((req, res, next) => {
  logger.info(`${req.method} ${req.path}`, { 
    query: req.query,
    body: req.method === 'POST' ? req.body : undefined
  });
  next();
});

// Ensure directories exist
[dataDir, reportsDir].forEach(dir => {
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
    logger.info(`Created directory: ${dir}`);
  } else {
    logger.debug(`Directory exists: ${dir}`);
  }
});

// Configure multer for file upload
const storage = multer.diskStorage({
  destination: function (req, file, cb) {
    logger.debug('File upload destination:', dataDir);
    cb(null, dataDir);
  },
  filename: function (req, file, cb) {
    logger.debug('Original file name:', file.originalname);
    cb(null, 'loan_data.csv');
  }
});

const upload = multer({ storage: storage });

// Routes
app.post('/api/upload', upload.single('file'), (req, res) => {
  logger.info('File upload request received');
  
  if (!req.file) {
    logger.error('No file uploaded');
    return res.status(400).json({ error: 'No file uploaded' });
  }
  
  // Verify file was uploaded successfully
  const filePath = path.join(dataDir, 'loan_data.csv');
  if (!fs.existsSync(filePath)) {
    logger.error('File upload failed - File not found after upload');
    return res.status(500).json({ error: 'File upload failed' });
  }
  
  // Log file details
  const stats = fs.statSync(filePath);
  logger.info('File upload successful', {
    path: filePath,
    size: stats.size,
    created: stats.birthtime,
    modified: stats.mtime
  });

  // Verify file content
  try {
    const firstLine = fs.readFileSync(filePath, 'utf8').split('\n')[0];
    logger.debug('File header:', firstLine);
  } catch (err) {
    logger.error('Error reading file header:', err);
  }
  
  res.json({ message: 'File uploaded successfully' });
});

app.post('/api/train', (req, res) => {
  logger.info('Model training request received');

  // Verify data file exists before training
  const dataFile = path.join(dataDir, 'loan_data.csv');
  if (!fs.existsSync(dataFile)) {
    logger.error('Data file not found:', dataFile);
    return res.status(400).json({ error: 'Data file not found. Please upload the data first.' });
  }

  logger.info('Starting training process', {
    dataFile,
    projectRoot,
    timestamp: new Date().toISOString()
  });
  
  const pythonProcess = spawn('python', ['run_pipeline.py'], {
    cwd: projectRoot // Set working directory to project root
  });
  
  let output = '';
  let error = '';

  pythonProcess.stdout.on('data', (data) => {
    const message = data.toString();
    output += message;
    logger.debug('Python output:', message.trim());
  });

  pythonProcess.stderr.on('data', (data) => {
    const message = data.toString();
    error += message;
    logger.error('Python error:', message.trim());
  });

  pythonProcess.on('close', (code) => {
    logger.info('Training process completed', { exitCode: code });
    
    if (code !== 0) {
      logger.error('Training failed', {
        exitCode: code,
        error: error.trim(),
        output: output.trim()
      });
      
      return res.status(500).json({ 
        error: 'Training failed', 
        details: error,
        output: output 
      });
    }

    // Verify that the required files were generated
    const requiredFiles = [
      path.join(reportsDir, 'confusion_matrix.png'),
      path.join(reportsDir, 'feature_importance.csv'),
      path.join(reportsDir, 'lime_explanations'),
      path.join(reportsDir, 'shap_explanations')
    ];

    const missingFiles = requiredFiles.filter(file => !fs.existsSync(file));
    
    if (missingFiles.length > 0) {
      logger.error('Some required files were not generated:', missingFiles);
      return res.status(500).json({
        error: 'Training completed but some files were not generated',
        missingFiles
      });
    }

    logger.info('Training completed successfully, all files generated');
    res.json({ 
      message: 'Training completed successfully',
      output: output
    });
  });
});

app.get('/api/results', (req, res) => {
  logger.info('Results request received');

  // Check if the required files exist
  const files = {
    confusionMatrix: path.join(reportsDir, 'confusion_matrix.png'),
    featureImportance: path.join(reportsDir, 'feature_importance.csv'),
    limeExplanations: path.join(reportsDir, 'lime_explanations'),
    shapExplanations: path.join(reportsDir, 'shap_explanations')
  };

  // Log the absolute paths being checked
  logger.debug('Checking files in reports directory:', {
    reportsDir,
    absolutePaths: files
  });

  // List all files in the reports directory
  try {
    const reportFiles = fs.readdirSync(reportsDir);
    logger.debug('Files found in reports directory:', reportFiles);
  } catch (err) {
    logger.error('Error reading reports directory:', err);
  }

  const fileExists = {};
  for (const [key, filepath] of Object.entries(files)) {
    fileExists[key] = fs.existsSync(filepath);
    if (!fileExists[key]) {
      logger.error(`File not found: ${key}`, {
        path: filepath,
        exists: fileExists[key]
      });
    } else {
      logger.info(`File found: ${key}`, {
        path: filepath,
        stats: fs.statSync(filepath)
      });
    }
  }

  // Return paths to all generated visualizations and reports
  const results = {
    confusionMatrix: fileExists.confusionMatrix ? '/reports/confusion_matrix.png' : null,
    featureImportance: fileExists.featureImportance ? '/reports/feature_importance.csv' : null,
    limeExplanations: fileExists.limeExplanations ? '/reports/lime_explanations/' : null,
    shapExplanations: fileExists.shapExplanations ? '/reports/shap_explanations/' : null,
    fileStatus: fileExists,
    debug: {
      reportsDir,
      checkedPaths: files
    }
  };
  
  logger.info('Sending results', results);
  res.json(results);
});

// Error handling middleware
app.use((err, req, res, next) => {
  logger.error('Unhandled error:', err.stack);
  res.status(500).json({ error: 'Something went wrong!' });
});

app.listen(port, () => {
  logger.info('Server started', {
    port,
    dataDirectory: dataDir,
    reportsDirectory: reportsDir,
    environment: process.env.NODE_ENV || 'development'
  });
}); 