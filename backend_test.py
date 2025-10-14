import requests
import sys
import json
from datetime import datetime, timedelta

class ChurchAttendanceAPITester:
    def __init__(self, base_url="https://worship-check.preview.emergentagent.com"):
        self.base_url = base_url
        self.api_url = f"{base_url}/api"
        self.token = None
        self.tests_run = 0
        self.tests_passed = 0
        self.test_results = []
        self.created_member_id = None
        self.created_visitor_id = None

    def log_test(self, name, success, details=""):
        """Log test result"""
        self.tests_run += 1
        if success:
            self.tests_passed += 1
            print(f"✅ {name} - PASSED")
        else:
            print(f"❌ {name} - FAILED: {details}")
        
        self.test_results.append({
            "test": name,
            "success": success,
            "details": details
        })

    def run_test(self, name, method, endpoint, expected_status, data=None, headers=None):
        """Run a single API test"""
        url = f"{self.api_url}/{endpoint}"
        test_headers = {'Content-Type': 'application/json'}
        
        if self.token:
            test_headers['Authorization'] = f'Bearer {self.token}'
        
        if headers:
            test_headers.update(headers)

        try:
            if method == 'GET':
                response = requests.get(url, headers=test_headers, timeout=10)
            elif method == 'POST':
                response = requests.post(url, json=data, headers=test_headers, timeout=10)
            elif method == 'PUT':
                response = requests.put(url, json=data, headers=test_headers, timeout=10)
            elif method == 'DELETE':
                response = requests.delete(url, headers=test_headers, timeout=10)

            success = response.status_code == expected_status
            details = f"Status: {response.status_code}"
            
            if not success:
                details += f", Expected: {expected_status}"
                try:
                    error_data = response.json()
                    details += f", Response: {error_data}"
                except:
                    details += f", Response: {response.text[:200]}"

            self.log_test(name, success, details)
            
            if success:
                try:
                    return response.json()
                except:
                    return {}
            return None

        except Exception as e:
            self.log_test(name, False, f"Exception: {str(e)}")
            return None

    def test_auth_register(self):
        """Test user registration"""
        test_user = f"testuser_{datetime.now().strftime('%H%M%S')}"
        data = {
            "username": test_user,
            "password": "TestPass123!"
        }
        
        response = self.run_test(
            "Auth - Register",
            "POST",
            "auth/register",
            200,
            data
        )
        
        if response and 'access_token' in response:
            self.token = response['access_token']
            return True
        return False

    def test_auth_login(self):
        """Test user login with existing user"""
        # First register a user
        test_user = f"loginuser_{datetime.now().strftime('%H%M%S')}"
        register_data = {
            "username": test_user,
            "password": "LoginPass123!"
        }
        
        # Register
        register_response = self.run_test(
            "Auth - Register for Login Test",
            "POST",
            "auth/register",
            200,
            register_data
        )
        
        if not register_response:
            return False
            
        # Now test login
        login_data = {
            "username": test_user,
            "password": "LoginPass123!"
        }
        
        response = self.run_test(
            "Auth - Login",
            "POST",
            "auth/login",
            200,
            login_data
        )
        
        return response and 'access_token' in response

    def test_members_crud(self):
        """Test Members CRUD operations"""
        if not self.token:
            self.log_test("Members CRUD", False, "No authentication token")
            return False

        # Create Member
        member_data = {
            "nombre": "Juan",
            "apellido": "Pérez",
            "direccion": "Calle 123, Ciudad",
            "telefono": "555-1234"
        }
        
        create_response = self.run_test(
            "Members - Create",
            "POST",
            "members",
            200,
            member_data
        )
        
        if not create_response or 'id' not in create_response:
            return False
            
        self.created_member_id = create_response['id']
        
        # Get All Members
        self.run_test(
            "Members - Get All",
            "GET",
            "members",
            200
        )
        
        # Get Single Member
        self.run_test(
            "Members - Get Single",
            "GET",
            f"members/{self.created_member_id}",
            200
        )
        
        # Update Member
        update_data = {
            "nombre": "Juan Carlos",
            "apellido": "Pérez García",
            "direccion": "Avenida 456, Ciudad",
            "telefono": "555-5678"
        }
        
        self.run_test(
            "Members - Update",
            "PUT",
            f"members/{self.created_member_id}",
            200,
            update_data
        )
        
        return True

    def test_visitors_crud(self):
        """Test Visitors CRUD operations"""
        if not self.token:
            self.log_test("Visitors CRUD", False, "No authentication token")
            return False

        # Create Visitor
        visitor_data = {
            "nombre": "María González",
            "de_donde_viene": "Ciudad Vecina"
        }
        
        create_response = self.run_test(
            "Visitors - Create",
            "POST",
            "visitors",
            200,
            visitor_data
        )
        
        if not create_response or 'id' not in create_response:
            return False
            
        self.created_visitor_id = create_response['id']
        
        # Get All Visitors
        self.run_test(
            "Visitors - Get All",
            "GET",
            "visitors",
            200
        )
        
        # Get Single Visitor
        self.run_test(
            "Visitors - Get Single",
            "GET",
            f"visitors/{self.created_visitor_id}",
            200
        )
        
        # Update Visitor
        update_data = {
            "nombre": "María Elena González",
            "de_donde_viene": "Otra Ciudad"
        }
        
        self.run_test(
            "Visitors - Update",
            "PUT",
            f"visitors/{self.created_visitor_id}",
            200,
            update_data
        )
        
        return True

    def test_attendance(self):
        """Test Attendance operations"""
        if not self.token or not self.created_member_id or not self.created_visitor_id:
            self.log_test("Attendance", False, "Missing prerequisites (token, member, visitor)")
            return False

        today = datetime.now().strftime('%Y-%m-%d')
        
        # Create Member Attendance
        member_attendance = {
            "tipo": "member",
            "person_id": self.created_member_id,
            "person_name": "Juan Carlos Pérez García",
            "fecha": today,
            "presente": True
        }
        
        self.run_test(
            "Attendance - Create Member",
            "POST",
            "attendance",
            200,
            member_attendance
        )
        
        # Create Visitor Attendance
        visitor_attendance = {
            "tipo": "visitor",
            "person_id": self.created_visitor_id,
            "person_name": "María Elena González",
            "fecha": today,
            "presente": True
        }
        
        self.run_test(
            "Attendance - Create Visitor",
            "POST",
            "attendance",
            200,
            visitor_attendance
        )
        
        # Get Attendance by Date
        self.run_test(
            "Attendance - Get by Date",
            "GET",
            f"attendance?fecha={today}",
            200
        )
        
        # Get Person Attendance
        self.run_test(
            "Attendance - Get Person History",
            "GET",
            f"attendance/person/{self.created_member_id}?tipo=member",
            200
        )
        
        return True

    def test_reports(self):
        """Test Reports endpoints"""
        if not self.token:
            self.log_test("Reports", False, "No authentication token")
            return False

        today = datetime.now().strftime('%Y-%m-%d')
        yesterday = (datetime.now() - timedelta(days=1)).strftime('%Y-%m-%d')
        
        # Date Range Report
        self.run_test(
            "Reports - Date Range",
            "GET",
            f"reports/by-date-range?start={yesterday}&end={today}&tipo=all",
            200
        )
        
        # Individual Report
        if self.created_member_id:
            self.run_test(
                "Reports - Individual",
                "GET",
                f"reports/individual/{self.created_member_id}?tipo=member&start={yesterday}&end={today}",
                200
            )
        
        # Collective Report
        self.run_test(
            "Reports - Collective",
            "GET",
            f"reports/collective?start={yesterday}&end={today}",
            200
        )
        
        return True

    def test_dashboard(self):
        """Test Dashboard stats"""
        if not self.token:
            self.log_test("Dashboard", False, "No authentication token")
            return False

        self.run_test(
            "Dashboard - Stats",
            "GET",
            "dashboard/stats",
            200
        )
        
        return True

    def test_cleanup(self):
        """Clean up created test data"""
        if not self.token:
            return

        # Delete created member
        if self.created_member_id:
            self.run_test(
                "Cleanup - Delete Member",
                "DELETE",
                f"members/{self.created_member_id}",
                200
            )
        
        # Delete created visitor
        if self.created_visitor_id:
            self.run_test(
                "Cleanup - Delete Visitor",
                "DELETE",
                f"visitors/{self.created_visitor_id}",
                200
            )

    def run_all_tests(self):
        """Run all API tests"""
        print(f"🚀 Starting API tests for Church Attendance System")
        print(f"📍 Base URL: {self.base_url}")
        print("=" * 60)
        
        # Test Authentication
        if not self.test_auth_register():
            print("❌ Authentication failed, stopping tests")
            return False
            
        self.test_auth_login()
        
        # Test CRUD operations
        self.test_members_crud()
        self.test_visitors_crud()
        
        # Test Attendance
        self.test_attendance()
        
        # Test Reports
        self.test_reports()
        
        # Test Dashboard
        self.test_dashboard()
        
        # Cleanup
        self.test_cleanup()
        
        # Print results
        print("=" * 60)
        print(f"📊 Test Results: {self.tests_passed}/{self.tests_run} passed")
        success_rate = (self.tests_passed / self.tests_run * 100) if self.tests_run > 0 else 0
        print(f"📈 Success Rate: {success_rate:.1f}%")
        
        if self.tests_passed < self.tests_run:
            print("\n❌ Failed Tests:")
            for result in self.test_results:
                if not result['success']:
                    print(f"  - {result['test']}: {result['details']}")
        
        return self.tests_passed == self.tests_run

def main():
    tester = ChurchAttendanceAPITester()
    success = tester.run_all_tests()
    return 0 if success else 1

if __name__ == "__main__":
    sys.exit(main())