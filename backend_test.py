import requests
import sys
import json
from datetime import datetime

class GeoMedAPITester:
    def __init__(self, base_url="https://medpro-finder-1.preview.emergentagent.com"):
        self.base_url = base_url
        self.api_url = f"{base_url}/api"
        self.tests_run = 0
        self.tests_passed = 0
        self.created_search_id = None

    def run_test(self, name, method, endpoint, expected_status, data=None, timeout=60):
        """Run a single API test"""
        url = f"{self.api_url}/{endpoint}"
        headers = {'Content-Type': 'application/json'}

        self.tests_run += 1
        print(f"\n🔍 Testing {name}...")
        print(f"   URL: {url}")
        
        try:
            if method == 'GET':
                response = requests.get(url, headers=headers, timeout=timeout)
            elif method == 'POST':
                response = requests.post(url, json=data, headers=headers, timeout=timeout)

            success = response.status_code == expected_status
            if success:
                self.tests_passed += 1
                print(f"✅ Passed - Status: {response.status_code}")
                try:
                    response_data = response.json()
                    print(f"   Response keys: {list(response_data.keys()) if isinstance(response_data, dict) else 'List with ' + str(len(response_data)) + ' items'}")
                    return True, response_data
                except:
                    return True, {}
            else:
                print(f"❌ Failed - Expected {expected_status}, got {response.status_code}")
                try:
                    error_detail = response.json()
                    print(f"   Error: {error_detail}")
                except:
                    print(f"   Error: {response.text}")
                return False, {}

        except requests.exceptions.Timeout:
            print(f"❌ Failed - Request timed out after {timeout} seconds")
            return False, {}
        except Exception as e:
            print(f"❌ Failed - Error: {str(e)}")
            return False, {}

    def test_root_endpoint(self):
        """Test the root API endpoint"""
        return self.run_test("Root API Endpoint", "GET", "", 200)

    def test_predict_country(self):
        """Test country prediction with sample data"""
        test_data = {
            "name": "Dr. Sarah Johnson",
            "email": "sarah.johnson@stanford.edu", 
            "hospital": "Stanford Medical Center",
            "pubmed_topic": "Cardiology"
        }
        
        success, response = self.run_test(
            "Country Prediction",
            "POST", 
            "predict-country",
            200,
            data=test_data,
            timeout=90  # Longer timeout for AI processing
        )
        
        if success and response:
            # Validate response structure
            required_fields = ['id', 'name', 'email', 'hospital', 'pubmed_topic', 
                             'predicted_country', 'confidence_score', 'sources', 'reasoning']
            missing_fields = [field for field in required_fields if field not in response]
            
            if missing_fields:
                print(f"⚠️  Warning: Missing fields in response: {missing_fields}")
            else:
                print(f"✅ All required fields present")
                print(f"   Predicted Country: {response.get('predicted_country')}")
                print(f"   Confidence Score: {response.get('confidence_score')}%")
                print(f"   Sources: {response.get('sources')}")
                
                # Store the ID for later tests
                self.created_search_id = response.get('id')
                
        return success

    def test_get_search_history(self):
        """Test retrieving all search history"""
        success, response = self.run_test(
            "Get Search History",
            "GET",
            "search-history", 
            200
        )
        
        if success and isinstance(response, list):
            print(f"   Found {len(response)} searches in history")
            if len(response) > 0:
                print(f"   Latest search: {response[0].get('name', 'Unknown')}")
        
        return success

    def test_get_search_by_id(self):
        """Test retrieving specific search by ID"""
        if not self.created_search_id:
            print("⚠️  Skipping - No search ID available from previous test")
            return True
            
        success, response = self.run_test(
            "Get Search by ID",
            "GET",
            f"search-history/{self.created_search_id}",
            200
        )
        
        if success and response:
            print(f"   Retrieved search for: {response.get('name')}")
            print(f"   Country: {response.get('predicted_country')}")
            
        return success

    def test_edge_cases(self):
        """Test edge cases and different data patterns"""
        print(f"\n🧪 Testing Edge Cases...")
        
        # Test with different email domains
        test_cases = [
            {
                "name": "Dr. Hiroshi Tanaka",
                "email": "h.tanaka@tokyo.ac.jp",
                "hospital": "Tokyo General Hospital", 
                "pubmed_topic": "Neuroscience"
            },
            {
                "name": "Dr. Emma Wilson",
                "email": "e.wilson@nhs.uk",
                "hospital": "Royal London Hospital",
                "pubmed_topic": "Oncology"
            }
        ]
        
        edge_case_success = 0
        for i, test_data in enumerate(test_cases):
            success, response = self.run_test(
                f"Edge Case {i+1} ({test_data['email'].split('@')[1]})",
                "POST",
                "predict-country", 
                200,
                data=test_data,
                timeout=90
            )
            if success:
                edge_case_success += 1
                print(f"   Predicted: {response.get('predicted_country')} ({response.get('confidence_score')}%)")
        
        return edge_case_success == len(test_cases)

    def test_invalid_requests(self):
        """Test invalid request handling"""
        print(f"\n🚫 Testing Invalid Requests...")
        
        # Test empty request
        success, _ = self.run_test(
            "Empty Request Body",
            "POST",
            "predict-country",
            422,  # Validation error expected
            data={}
        )
        
        # Test missing fields
        success2, _ = self.run_test(
            "Missing Required Fields",
            "POST", 
            "predict-country",
            422,
            data={"name": "Dr. Test"}
        )
        
        # Test invalid search ID
        success3, _ = self.run_test(
            "Invalid Search ID",
            "GET",
            "search-history/invalid-id-123",
            404
        )
        
        return success and success2 and success3

def main():
    print("🏥 GeoMed AI Backend API Testing")
    print("=" * 50)
    
    tester = GeoMedAPITester()
    
    # Run all tests
    tests = [
        ("Root Endpoint", tester.test_root_endpoint),
        ("Country Prediction", tester.test_predict_country), 
        ("Search History", tester.test_get_search_history),
        ("Search by ID", tester.test_get_search_by_id),
        ("Edge Cases", tester.test_edge_cases),
        ("Invalid Requests", tester.test_invalid_requests)
    ]
    
    for test_name, test_func in tests:
        try:
            test_func()
        except Exception as e:
            print(f"❌ {test_name} failed with exception: {str(e)}")
    
    # Print final results
    print(f"\n📊 Test Results")
    print("=" * 30)
    print(f"Tests Run: {tester.tests_run}")
    print(f"Tests Passed: {tester.tests_passed}")
    print(f"Success Rate: {(tester.tests_passed/tester.tests_run*100):.1f}%" if tester.tests_run > 0 else "0%")
    
    if tester.tests_passed == tester.tests_run:
        print("🎉 All tests passed!")
        return 0
    else:
        print("⚠️  Some tests failed - check logs above")
        return 1

if __name__ == "__main__":
    sys.exit(main())