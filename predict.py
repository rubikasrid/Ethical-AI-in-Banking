import pandas as pd
import numpy as np
import joblib
import os
import sys

def load_model():
    """Load the trained model"""
    try:
        model = joblib.load('data/model.joblib')
        return model
    except:
        print("Error: Model not found. Please run the training pipeline first.")
        sys.exit(1)

def preprocess_input(data):
    """Preprocess the input data"""
    # Convert categorical variables
    categorical_cols = ['Gender', 'Married', 'Education', 'Self_Employed']
    for col in categorical_cols:
        if col in data.columns:
            data[col] = data[col].map({'Male': 1, 'Female': 0, 'Yes': 1, 'No': 0, 
                                      'Graduate': 1, 'Not Graduate': 0})
    
    # Scale numerical features
    numerical_cols = ['ApplicantIncome', 'LoanAmount']
    for col in numerical_cols:
        if col in data.columns:
            data[col] = (data[col] - data[col].mean()) / data[col].std()
    
    return data

def predict_loan_approval(model, data):
    """Make predictions using the model"""
    # Select features
    feature_cols = ['ApplicantIncome', 'LoanAmount', 'Credit_History']
    X = data[feature_cols]
    
    # Make prediction
    prediction = model.predict(X)
    probability = model.predict_proba(X)
    
    return prediction, probability

def main():
    # Check if model exists
    if not os.path.exists('data/model.joblib'):
        print("Error: Model not found. Please run the training pipeline first.")
        sys.exit(1)
    
    # Load model
    model = load_model()
    
    # Get input data
    print("Enter loan application details:")
    print("-----------------------------")
    
    # Collect input data
    data = {}
    data['ApplicantIncome'] = float(input("Applicant Income: "))
    data['LoanAmount'] = float(input("Loan Amount: "))
    data['Credit_History'] = int(input("Credit History (1 for good, 0 for bad): "))
    
    # Convert to DataFrame
    df = pd.DataFrame([data])
    
    # Make prediction
    prediction, probability = predict_loan_approval(model, df)
    
    # Display results
    print("\nPrediction Results:")
    print("------------------")
    print(f"Loan Approval: {'Yes' if prediction[0] == 1 else 'No'}")
    print(f"Probability of Approval: {probability[0][1]:.2%}")
    print(f"Probability of Rejection: {probability[0][0]:.2%}")

if __name__ == "__main__":
    main() 