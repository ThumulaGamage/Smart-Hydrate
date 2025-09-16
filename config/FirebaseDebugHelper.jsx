// FirebaseDebugHelper.js - Add this to your project for debugging

import { auth, firestore, checkFirebaseInit, WaterBottleService } from './firebaseConfig';

// Debug function to test Firebase initialization
export const debugFirebaseInit = async () => {
  console.log('=== FIREBASE DEBUG START ===');
  
  try {
    // Check basic initialization
    const initStatus = checkFirebaseInit();
    console.log('Init Status:', initStatus);
    
    // Test auth
    console.log('Current User:', auth.currentUser);
    
    // Test Firestore basic connection
    console.log('Firestore instance:', firestore);
    
    // Test collection creation (this is where your error likely occurs)
    try {
      const testCollection = firestore.collection('test');
      console.log('Test collection created successfully:', testCollection);
    } catch (collectionError) {
      console.error('ERROR: Failed to create test collection:', collectionError);
      return { error: 'Collection creation failed', details: collectionError };
    }
    
    // Test with actual user ID if available
    if (auth.currentUser) {
      console.log('Testing with actual user ID:', auth.currentUser.uid);
      try {
        const service = new WaterBottleService(auth.currentUser.uid);
        console.log('WaterBottleService created successfully');
        
        // Test a simple read operation
        const profile = await service.getUserProfile();
        console.log('Profile read test:', profile);
        
        return { success: true, service, profile };
      } catch (serviceError) {
        console.error('ERROR: WaterBottleService failed:', serviceError);
        return { error: 'Service creation failed', details: serviceError };
      }
    } else {
      console.log('No authenticated user - testing with default user');
      try {
        const service = new WaterBottleService('debug_user');
        console.log('WaterBottleService created with debug user');
        return { success: true, service };
      } catch (serviceError) {
        console.error('ERROR: WaterBottleService failed with debug user:', serviceError);
        return { error: 'Service creation failed', details: serviceError };
      }
    }
    
  } catch (error) {
    console.error('GENERAL ERROR in Firebase debug:', error);
    return { error: 'General Firebase error', details: error };
  } finally {
    console.log('=== FIREBASE DEBUG END ===');
  }
};

// Call this function in your component's useEffect to debug
// Example usage:
// useEffect(() => {
//   debugFirebaseInit().then(result => {
//     console.log('Debug result:', result);
//   });
// }, []);