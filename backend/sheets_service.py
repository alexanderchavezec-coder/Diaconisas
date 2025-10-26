import gspread
from google.oauth2.service_account import Credentials
from typing import List, Dict, Optional
import os
from pathlib import Path

ROOT_DIR = Path(__file__).parent

# Scopes required for read/write access
SCOPES = [
    'https://www.googleapis.com/auth/spreadsheets',
    'https://www.googleapis.com/auth/drive'
]

class SheetsService:
    def __init__(self):
        """Initialize Google Sheets connection with Service Account"""
        try:
            creds = Credentials.from_service_account_file(
                ROOT_DIR / 'credentials.json',
                scopes=SCOPES
            )
            self.client = gspread.authorize(creds)
            self.spreadsheet_id = '1kXfyAMTqZovXA6rzM2cYXbyoDYJdQwXs3-tdawvy-Aw'
            self.spreadsheet = self.client.open_by_key(self.spreadsheet_id)
            
            # Define expected headers for each sheet to avoid duplicate empty column issues
            self.expected_headers = {
                'Miembros': ['id', 'nombre', 'apellido', 'direccion', 'telefono', 'fecha_registro'],
                'Amigos': ['id', 'nombre', 'de_donde_viene', 'fecha_registro'],
                'Asistencia': ['tipo', 'person_id', 'person_name', 'fecha', 'presente', 'id', 'created_at']
            }
        except Exception as e:
            raise Exception(f"Failed to initialize Sheets service: {str(e)}")
    
    def get_worksheet(self, sheet_name: str):
        """Get worksheet by name with error handling"""
        try:
            return self.spreadsheet.worksheet(sheet_name)
        except gspread.exceptions.WorksheetNotFound:
            raise ValueError(f"Worksheet '{sheet_name}' not found")
        except Exception as e:
            raise Exception(f"Error accessing worksheet: {str(e)}")
    
    # READ Operations
    def read_all(self, sheet_name: str) -> List[Dict]:
        """Read all records from a sheet"""
        try:
            worksheet = self.get_worksheet(sheet_name)
            # Use expected_headers if defined to avoid issues with empty duplicate columns
            if sheet_name in self.expected_headers:
                records = worksheet.get_all_records(expected_headers=self.expected_headers[sheet_name])
            else:
                records = worksheet.get_all_records()
            
            # Filter out empty string keys from each record
            cleaned_records = []
            for record in records:
                cleaned_record = {k: v for k, v in record.items() if k != ''}
                cleaned_records.append(cleaned_record)
            
            return cleaned_records
        except Exception as e:
            raise Exception(f"Read error: {str(e)}")
    
    def find_row_by_id(self, sheet_name: str, record_id: str) -> Optional[Dict]:
        """Find a record by ID"""
        try:
            records = self.read_all(sheet_name)
            for idx, record in enumerate(records, start=2):  # Start at 2 (header is row 1)
                if str(record.get('id', '')) == str(record_id):
                    record['_row'] = idx
                    return record
            return None
        except Exception as e:
            raise Exception(f"Find error: {str(e)}")
    
    # CREATE Operation
    def append_row(self, sheet_name: str, values: List) -> Dict:
        """Append a new row to the sheet"""
        try:
            worksheet = self.get_worksheet(sheet_name)
            worksheet.append_row(values, value_input_option='USER_ENTERED')
            return {"success": True}
        except Exception as e:
            raise Exception(f"Append error: {str(e)}")
    
    # UPDATE Operation
    def update_row(self, sheet_name: str, row_number: int, values: List) -> Dict:
        """Update an entire row by row number"""
        try:
            worksheet = self.get_worksheet(sheet_name)
            # Get number of columns from header
            header = worksheet.row_values(1)
            num_cols = len(header)
            # Ensure values match header length
            if len(values) < num_cols:
                values.extend([''] * (num_cols - len(values)))
            cell_range = f"A{row_number}:{chr(64 + num_cols)}{row_number}"
            worksheet.update([values], cell_range, value_input_option='USER_ENTERED')
            return {"success": True, "row": row_number}
        except Exception as e:
            raise Exception(f"Update row error: {str(e)}")
    
    # DELETE Operation
    def delete_row(self, sheet_name: str, row_number: int) -> Dict:
        """Delete a specific row"""
        try:
            worksheet = self.get_worksheet(sheet_name)
            worksheet.delete_rows(row_number)
            return {"success": True, "deleted_row": row_number}
        except Exception as e:
            raise Exception(f"Delete row error: {str(e)}")

sheets_service = SheetsService()