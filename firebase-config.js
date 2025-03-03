// Firebase configuration
const firebaseConfig = {
  apiKey: "AIzaSyAA8czkuKcsWVZZpSzv0my9atjmXtjePg4",
  authDomain: "controle-de-estoque-4dce4.firebaseapp.com",
  projectId: "controle-de-estoque-4dce4",
  storageBucket: "controle-de-estoque-4dce4.firebasestorage.app",
  messagingSenderId: "73205344933",
  appId: "1:73205344933:web:db3b6b68d0b2c44a39bb4c",
  measurementId: "G-E56ZN2DGWM"
};

// Initialize Firebase
firebase.initializeApp(firebaseConfig);
const db = firebase.firestore();
const auth = firebase.auth();

// Firebase database functions
async function saveItem(item) {
  try {
    await db.collection('itens').add(item);
    return true;
  } catch (error) {
    console.error("Error adding document: ", error);
    return false;
  }
}

async function getItems() {
  try {
    const snapshot = await db.collection('itens').get();
    const items = [];
    snapshot.forEach(doc => {
      items.push({ id: doc.id, ...doc.data() });
    });
    return items;
  } catch (error) {
    console.error("Error getting documents: ", error);
    return [];
  }
}

async function updateItem(id, item) {
  try {
    await db.collection('itens').doc(id).update(item);
    return true;
  } catch (error) {
    console.error("Error updating document: ", error);
    return false;
  }
}

async function deleteItem(id) {
  try {
    await db.collection('itens').doc(id).delete();
    return true;
  } catch (error) {
    console.error("Error deleting document: ", error);
    return false;
  }
}

async function saveUpdateHistory(itemId, oldItem, newItem, action) {
  try {
    const historyEntry = {
      itemId: itemId,
      itemName: newItem?.nome || oldItem?.nome,
      action: action, // "create", "update", "delete"
      oldValues: action !== "create" ? oldItem : null,
      newValues: action !== "delete" ? newItem : null,
      timestamp: firebase.firestore.FieldValue.serverTimestamp(),
      user: "Sistema" // Can be replaced with actual user info if authentication is implemented
    };
    await db.collection('historico').add(historyEntry);
    return true;
  } catch (error) {
    console.error("Error saving history: ", error);
    return false;
  }
}

async function getUpdateHistory(itemId = null) {
  try {
    let query = db.collection('historico').orderBy('timestamp', 'desc');
    if (itemId) {
      query = query.where('itemId', '==', itemId);
    }
    const snapshot = await query.limit(100).get();
    const history = [];
    snapshot.forEach(doc => {
      const data = doc.data();
      // Convert timestamp to readable format if it exists
      if (data.timestamp) {
        const date = data.timestamp.toDate();
        data.formattedDate = date.toLocaleDateString('pt-BR') + ' ' + 
                            date.toLocaleTimeString('pt-BR');
      }
      history.push({ id: doc.id, ...data });
    });
    return history;
  } catch (error) {
    console.error("Error getting history: ", error);
    return [];
  }
}

async function getItemById(id) {
  try {
    const doc = await db.collection('itens').doc(id).get();
    if (doc.exists) {
      return { id: doc.id, ...doc.data() };
    } else {
      console.error("No such document!");
      return null;
    }
  } catch (error) {
    console.error("Error getting document: ", error);
    return null;
  }
}