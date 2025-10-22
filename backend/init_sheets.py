#!/usr/bin/env python3
"""Initialize Google Sheets with headers"""
from sheets_service import sheets_service

def init_sheets():
    try:
        # Initialize Miembros sheet
        try:
            ws = sheets_service.get_worksheet('Miembros')
            headers = ws.row_values(1)
            if not headers or headers[0] != 'id':
                ws.clear()
                ws.append_row(['id', 'nombre', 'apellido', 'direccion', 'telefono', 'fecha_registro'])
                print("✅ Miembros sheet initialized with headers")
            else:
                print("✅ Miembros sheet already has headers")
        except Exception as e:
            print(f"❌ Error initializing Miembros: {e}")
        
        # Initialize Amigos sheet
        try:
            ws = sheets_service.get_worksheet('Amigos')
            headers = ws.row_values(1)
            if not headers or headers[0] != 'id':
                ws.clear()
                ws.append_row(['id', 'nombre', 'de_donde_viene', 'fecha_registro'])
                print("✅ Amigos sheet initialized with headers")
            else:
                print("✅ Amigos sheet already has headers")
        except Exception as e:
            print(f"❌ Error initializing Amigos: {e}")
        
        # Initialize Asistencia sheet
        try:
            try:
                ws = sheets_service.get_worksheet('Asistencia')
            except:
                # Create the worksheet if it doesn't exist
                ws = sheets_service.spreadsheet.add_worksheet(title='Asistencia', rows=1000, cols=10)
                print("✅ Created Asistencia worksheet")
            
            headers = ws.row_values(1)
            if not headers or headers[0] != 'tipo':
                ws.clear()
                ws.append_row(['tipo', 'person_id', 'person_name', 'fecha', 'presente', 'id', 'created_at'])
                print("✅ Asistencia sheet initialized with headers")
            else:
                print("✅ Asistencia sheet already has headers")
        except Exception as e:
            print(f"❌ Error initializing Asistencia: {e}")
            
    except Exception as e:
        print(f"❌ Failed to initialize sheets: {e}")

if __name__ == "__main__":
    init_sheets()
