import { initializeApp } from 'firebase/app';
import { getFunctions } from 'firebase/functions';
import { getFirestore } from 'firebase/firestore';
// TODO: Add SDKs for Firebase products that you want to use
// https://firebase.google.com/docs/web/setup#available-libraries

// Your web app's Firebase configuration
const firebaseConfig = {
  apiKey: 'AIzaSyDN0wSlbaMXdkq_uQvEOSztbxm37OMbjsw',
  authDomain: 'suidegen.firebaseapp.com',
  projectId: 'suidegen',
  storageBucket: 'suidegen.appspot.com',
  messagingSenderId: '949487638463',
  appId: '1:949487638463:web:573bedab213ad16959f30a',
};

// Initialize Firebase
const app = initializeApp(firebaseConfig);
export const functions = getFunctions(app);
export const db = getFirestore(app); // Export Firestore instance
