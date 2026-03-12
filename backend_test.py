import requests
import sys
import json
from datetime import datetime
import os
import io

class ITHelpdeskTester:
    def __init__(self, base_url="https://support-desk-105.preview.emergentagent.com/api"):
        self.base_url = base_url
        self.admin_token = None
        self.user_token = None
        self.tests_run = 0
        self.tests_passed = 0
        self.test_user_id = None
        self.test_ticket_id = None
        self.admin_user_id = None

    def log_test(self, name, success, details=""):
        """Log test result"""
        self.tests_run += 1
        if success:
            self.tests_passed += 1
            print(f"✅ {name} - PASSED {details}")
        else:
            print(f"❌ {name} - FAILED {details}")
        return success

    def test_admin_login(self):
        """Test admin login with provided credentials"""
        print(f"\n🔍 Testing Admin Login...")
        try:
            response = requests.post(f"{self.base_url}/auth/login", json={
                "email": "admin@helpdesk.com",
                "password": "admin123"
            })
            
            if response.status_code == 200:
                data = response.json()
                if 'access_token' in data and data['user']['role'] == 'admin':
                    self.admin_token = data['access_token']
                    self.admin_user_id = data['user']['id']
                    return self.log_test("Admin Login", True, f"- Role: {data['user']['role']}")
                else:
                    return self.log_test("Admin Login", False, "- Missing token or not admin role")
            else:
                return self.log_test("Admin Login", False, f"- Status: {response.status_code}, Response: {response.text[:200]}")
                
        except Exception as e:
            return self.log_test("Admin Login", False, f"- Error: {str(e)}")

    def test_user_registration(self):
        """Test user registration"""
        print(f"\n🔍 Testing User Registration...")
        test_email = f"testuser_{datetime.now().strftime('%H%M%S')}@test.com"
        
        try:
            response = requests.post(f"{self.base_url}/auth/register", json={
                "name": "Test User",
                "email": test_email,
                "password": "testpass123",
                "role": "user"
            })
            
            if response.status_code == 200:
                data = response.json()
                if 'access_token' in data and data['user']['role'] == 'user':
                    self.user_token = data['access_token']
                    self.test_user_id = data['user']['id']
                    return self.log_test("User Registration", True, f"- Email: {test_email}")
                else:
                    return self.log_test("User Registration", False, "- Missing token or invalid role")
            else:
                return self.log_test("User Registration", False, f"- Status: {response.status_code}, Response: {response.text[:200]}")
                
        except Exception as e:
            return self.log_test("User Registration", False, f"- Error: {str(e)}")

    def test_dashboard_stats(self):
        """Test dashboard stats endpoint"""
        print(f"\n🔍 Testing Dashboard Stats...")
        
        for role, token in [("Admin", self.admin_token), ("User", self.user_token)]:
            try:
                headers = {'Authorization': f'Bearer {token}'}
                response = requests.get(f"{self.base_url}/tickets/stats", headers=headers)
                
                if response.status_code == 200:
                    data = response.json()
                    required_fields = ['total_tickets', 'open_tickets', 'in_progress_tickets', 'closed_tickets']
                    if all(field in data for field in required_fields):
                        self.log_test(f"Dashboard Stats ({role})", True, f"- Total: {data['total_tickets']}")
                    else:
                        self.log_test(f"Dashboard Stats ({role})", False, "- Missing required fields")
                else:
                    self.log_test(f"Dashboard Stats ({role})", False, f"- Status: {response.status_code}")
                    
            except Exception as e:
                self.log_test(f"Dashboard Stats ({role})", False, f"- Error: {str(e)}")

    def test_departments_endpoint(self):
        """Test departments endpoint"""
        print(f"\n🔍 Testing Departments Endpoint...")
        try:
            response = requests.get(f"{self.base_url}/departments")
            
            if response.status_code == 200:
                data = response.json()
                if 'departments' in data and len(data['departments']) > 0:
                    return self.log_test("Departments", True, f"- Count: {len(data['departments'])}")
                else:
                    return self.log_test("Departments", False, "- No departments found")
            else:
                return self.log_test("Departments", False, f"- Status: {response.status_code}")
                
        except Exception as e:
            return self.log_test("Departments", False, f"- Error: {str(e)}")

    def test_create_ticket(self):
        """Test ticket creation"""
        print(f"\n🔍 Testing Ticket Creation...")
        
        headers = {'Authorization': f'Bearer {self.user_token}'}
        ticket_data = {
            "title": "Test Ticket - Printer Issue",
            "description": "The office printer is not working. It shows a red light and paper jam error.",
            "priority": "Medium",
            "department": "IT Support"
        }
        
        try:
            response = requests.post(f"{self.base_url}/tickets", json=ticket_data, headers=headers)
            
            if response.status_code == 200:
                data = response.json()
                if 'id' in data and data['title'] == ticket_data['title']:
                    self.test_ticket_id = data['id']
                    return self.log_test("Create Ticket", True, f"- ID: {data['id'][:8]}...")
                else:
                    return self.log_test("Create Ticket", False, "- Missing ID or invalid data")
            else:
                return self.log_test("Create Ticket", False, f"- Status: {response.status_code}, Response: {response.text[:200]}")
                
        except Exception as e:
            return self.log_test("Create Ticket", False, f"- Error: {str(e)}")

    def test_get_tickets(self):
        """Test getting tickets list with filtering"""
        print(f"\n🔍 Testing Get Tickets...")
        
        for role, token in [("User", self.user_token), ("Admin", self.admin_token)]:
            try:
                headers = {'Authorization': f'Bearer {token}'}
                
                # Test basic list
                response = requests.get(f"{self.base_url}/tickets", headers=headers)
                if response.status_code == 200:
                    tickets = response.json()
                    self.log_test(f"Get Tickets ({role})", True, f"- Count: {len(tickets)}")
                    
                    # Test filtering
                    response = requests.get(f"{self.base_url}/tickets?priority=Medium", headers=headers)
                    if response.status_code == 200:
                        filtered = response.json()
                        self.log_test(f"Filter Tickets ({role})", True, f"- Medium Priority: {len(filtered)}")
                    else:
                        self.log_test(f"Filter Tickets ({role})", False, f"- Status: {response.status_code}")
                else:
                    self.log_test(f"Get Tickets ({role})", False, f"- Status: {response.status_code}")
                    
            except Exception as e:
                self.log_test(f"Get Tickets ({role})", False, f"- Error: {str(e)}")

    def test_ticket_details(self):
        """Test getting specific ticket details"""
        print(f"\n🔍 Testing Ticket Details...")
        
        if not self.test_ticket_id:
            return self.log_test("Ticket Details", False, "- No test ticket ID available")
            
        try:
            headers = {'Authorization': f'Bearer {self.user_token}'}
            response = requests.get(f"{self.base_url}/tickets/{self.test_ticket_id}", headers=headers)
            
            if response.status_code == 200:
                data = response.json()
                if data['id'] == self.test_ticket_id:
                    return self.log_test("Ticket Details", True, f"- Status: {data['status']}")
                else:
                    return self.log_test("Ticket Details", False, "- ID mismatch")
            else:
                return self.log_test("Ticket Details", False, f"- Status: {response.status_code}")
                
        except Exception as e:
            return self.log_test("Ticket Details", False, f"- Error: {str(e)}")

    def test_admin_ticket_update(self):
        """Test admin updating ticket status and assignment"""
        print(f"\n🔍 Testing Admin Ticket Update...")
        
        if not self.test_ticket_id:
            return self.log_test("Admin Update", False, "- No test ticket ID available")
            
        try:
            headers = {'Authorization': f'Bearer {self.admin_token}'}
            
            # Test status change
            response = requests.put(f"{self.base_url}/tickets/{self.test_ticket_id}", 
                                  json={"status": "In Progress"}, headers=headers)
            
            if response.status_code == 200:
                data = response.json()
                if data['status'] == "In Progress":
                    self.log_test("Admin Status Update", True, "- Changed to In Progress")
                    
                    # Test assignment
                    response = requests.put(f"{self.base_url}/tickets/{self.test_ticket_id}", 
                                          json={"assigned_to": self.admin_user_id}, headers=headers)
                    
                    if response.status_code == 200:
                        data = response.json()
                        if data['assigned_to'] == self.admin_user_id:
                            return self.log_test("Admin Assignment", True, "- Assigned to admin")
                        else:
                            return self.log_test("Admin Assignment", False, "- Assignment failed")
                    else:
                        return self.log_test("Admin Assignment", False, f"- Status: {response.status_code}")
                else:
                    return self.log_test("Admin Status Update", False, "- Status not changed")
            else:
                return self.log_test("Admin Status Update", False, f"- Status: {response.status_code}")
                
        except Exception as e:
            return self.log_test("Admin Update", False, f"- Error: {str(e)}")

    def test_comments(self):
        """Test adding and getting comments"""
        print(f"\n🔍 Testing Comments...")
        
        if not self.test_ticket_id:
            return self.log_test("Comments", False, "- No test ticket ID available")
            
        try:
            headers = {'Authorization': f'Bearer {self.user_token}'}
            
            # Add comment
            comment_data = {"comment": "I tried restarting the printer but it still doesn't work."}
            response = requests.post(f"{self.base_url}/tickets/{self.test_ticket_id}/comments", 
                                   json=comment_data, headers=headers)
            
            if response.status_code == 200:
                self.log_test("Add Comment", True, "- Comment added")
                
                # Get comments
                response = requests.get(f"{self.base_url}/tickets/{self.test_ticket_id}/comments", 
                                      headers=headers)
                
                if response.status_code == 200:
                    comments = response.json()
                    if len(comments) > 0:
                        return self.log_test("Get Comments", True, f"- Count: {len(comments)}")
                    else:
                        return self.log_test("Get Comments", False, "- No comments found")
                else:
                    return self.log_test("Get Comments", False, f"- Status: {response.status_code}")
            else:
                return self.log_test("Add Comment", False, f"- Status: {response.status_code}")
                
        except Exception as e:
            return self.log_test("Comments", False, f"- Error: {str(e)}")

    def test_history(self):
        """Test getting ticket history"""
        print(f"\n🔍 Testing Ticket History...")
        
        if not self.test_ticket_id:
            return self.log_test("History", False, "- No test ticket ID available")
            
        try:
            headers = {'Authorization': f'Bearer {self.user_token}'}
            response = requests.get(f"{self.base_url}/tickets/{self.test_ticket_id}/history", headers=headers)
            
            if response.status_code == 200:
                history = response.json()
                return self.log_test("Ticket History", True, f"- Entries: {len(history)}")
            else:
                return self.log_test("Ticket History", False, f"- Status: {response.status_code}")
                
        except Exception as e:
            return self.log_test("Ticket History", False, f"- Error: {str(e)}")

    def test_users_admin_only(self):
        """Test admin-only users endpoint"""
        print(f"\n🔍 Testing Admin Users Endpoint...")
        
        # Test with user token (should fail)
        try:
            headers = {'Authorization': f'Bearer {self.user_token}'}
            response = requests.get(f"{self.base_url}/users", headers=headers)
            
            if response.status_code == 403:
                self.log_test("User Access Denied", True, "- Correctly blocked user access")
            else:
                self.log_test("User Access Denied", False, f"- Should be 403, got {response.status_code}")
                
        except Exception as e:
            self.log_test("User Access Denied", False, f"- Error: {str(e)}")
            
        # Test with admin token (should work)
        try:
            headers = {'Authorization': f'Bearer {self.admin_token}'}
            response = requests.get(f"{self.base_url}/users", headers=headers)
            
            if response.status_code == 200:
                users = response.json()
                return self.log_test("Admin Users Access", True, f"- Users count: {len(users)}")
            else:
                return self.log_test("Admin Users Access", False, f"- Status: {response.status_code}")
                
        except Exception as e:
            return self.log_test("Admin Users Access", False, f"- Error: {str(e)}")

    def test_role_based_access(self):
        """Test role-based access control"""
        print(f"\n🔍 Testing Role-based Access Control...")
        
        # Test user can only see their own tickets
        if self.test_ticket_id:
            # User should see their ticket
            headers = {'Authorization': f'Bearer {self.user_token}'}
            response = requests.get(f"{self.base_url}/tickets/{self.test_ticket_id}", headers=headers)
            
            if response.status_code == 200:
                self.log_test("User Own Ticket Access", True, "- Can access own ticket")
            else:
                self.log_test("User Own Ticket Access", False, f"- Status: {response.status_code}")
                
            # Admin should also see the ticket
            headers = {'Authorization': f'Bearer {self.admin_token}'}
            response = requests.get(f"{self.base_url}/tickets/{self.test_ticket_id}", headers=headers)
            
            if response.status_code == 200:
                self.log_test("Admin All Ticket Access", True, "- Admin can access all tickets")
            else:
                self.log_test("Admin All Ticket Access", False, f"- Status: {response.status_code}")

    def run_all_tests(self):
        """Run all tests"""
        print("🚀 Starting IT Helpdesk Backend API Tests...")
        print(f"📍 Testing endpoint: {self.base_url}")
        
        # Authentication tests
        if not self.test_admin_login():
            print("❌ Admin login failed - stopping tests")
            return False
            
        if not self.test_user_registration():
            print("❌ User registration failed - stopping tests")
            return False
            
        # Core functionality tests
        self.test_dashboard_stats()
        self.test_departments_endpoint()
        self.test_create_ticket()
        self.test_get_tickets()
        self.test_ticket_details()
        self.test_admin_ticket_update()
        self.test_comments()
        self.test_history()
        self.test_users_admin_only()
        self.test_role_based_access()
        
        # Print results
        success_rate = (self.tests_passed / self.tests_run) * 100
        print(f"\n📊 Test Results: {self.tests_passed}/{self.tests_run} passed ({success_rate:.1f}%)")
        
        if success_rate >= 80:
            print("✅ Backend API tests mostly successful - proceeding to frontend testing")
            return True
        else:
            print("❌ Backend API has significant issues - frontend testing may be limited")
            return False

def main():
    tester = ITHelpdeskTester()
    success = tester.run_all_tests()
    return 0 if success else 1

if __name__ == "__main__":
    sys.exit(main())