import pandas as pd

df_emp = pd.read_excel(r'd:\attendence-zkt\emp_data.xls', engine='xlrd')
trainees = df_emp[df_emp['Department'].str.contains('Platoon', na=False)]
print("--- TRAINEES NAMES ---")
print(trainees['Name'].head(30).tolist())
