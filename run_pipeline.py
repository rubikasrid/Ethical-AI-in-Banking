import os
import subprocess
import sys

def run_command(command, description):
    """Run a command and print its output"""
    print(f"\n{'='*80}")
    print(f"Running: {description}")
    print(f"{'='*80}\n")
    
    try:
        result = subprocess.run(command, shell=True, check=True, 
                              stdout=subprocess.PIPE, stderr=subprocess.PIPE,
                              text=True)
        print(result.stdout)
        if result.stderr:
            print("Errors/Warnings:")
            print(result.stderr)
        return True
    except subprocess.CalledProcessError as e:
        print(f"Error running {description}:")
        print(e.stdout)
        print(e.stderr)
        return False

def main():
    # Create necessary directories
    os.makedirs('data', exist_ok=True)
    os.makedirs('reports', exist_ok=True)
    os.makedirs('reports/lime_explanations', exist_ok=True)
    os.makedirs('reports/shap_explanations', exist_ok=True)
    
    # Check if loan_data.csv exists
    if not os.path.exists('data/loan_data.csv'):
        print("Error: loan_data.csv not found in data/ directory")
        print("Please place your loan dataset in data/loan_data.csv")
        sys.exit(1)
    
    # Run the model training script
    if not run_command('python src/loan_model.py', 'Loan Model Training'):
        print("Error: Model training failed")
        sys.exit(1)
    
    # Run the model explanation script
    if not run_command('python src/explain_model.py', 'Model Explanation'):
        print("Error: Model explanation failed")
        sys.exit(1)
    
    print("\n" + "="*80)
    print("Loan Approval Pipeline Completed Successfully!")
    print("="*80)
    print("\nResults can be found in the following locations:")
    print("- Processed data: data/processed_data.csv")
    print("- Trained model: data/model.joblib")
    print("- Confusion matrix: reports/confusion_matrix.png")
    print("- Feature importance: reports/feature_importance.csv")
    print("- LIME explanations: reports/lime_explanations/")
    print("- SHAP explanations: reports/shap_explanations/")

if __name__ == "__main__":
    main() 