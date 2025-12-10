import {
  collection,
  addDoc,
  updateDoc,
  deleteDoc,
  doc,
  query,
  where,
  orderBy,
  onSnapshot,
  serverTimestamp
} from 'https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js';
import { db } from './firebase-config.js';

const GOALS_COLLECTION = 'goals';

export async function createGoal(userId, goalData) {
  try {
    const docRef = await addDoc(collection(db, GOALS_COLLECTION), {
      userId,
      title: goalData.title,
      description: goalData.description,
      targetDate: goalData.targetDate,
      progress: 0,
      status: 'active',
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp()
    });
    return { success: true, id: docRef.id };
  } catch (error) {
    return { success: false, error: error.message };
  }
}

export async function updateGoal(goalId, updates) {
  try {
    const goalRef = doc(db, GOALS_COLLECTION, goalId);
    await updateDoc(goalRef, {
      ...updates,
      updatedAt: serverTimestamp()
    });
    return { success: true };
  } catch (error) {
    return { success: false, error: error.message };
  }
}

export async function deleteGoal(goalId) {
  try {
    await deleteDoc(doc(db, GOALS_COLLECTION, goalId));
    return { success: true };
  } catch (error) {
    return { success: false, error: error.message };
  }
}

export function subscribeToGoals(userId, callback) {
  const q = query(
    collection(db, GOALS_COLLECTION),
    where('userId', '==', userId),
    orderBy('createdAt', 'desc')
  );

  return onSnapshot(q, (snapshot) => {
    const goals = [];
    snapshot.forEach((doc) => {
      goals.push({
        id: doc.id,
        ...doc.data()
      });
    });
    callback(goals);
  }, (error) => {
    console.error('Error fetching goals:', error);
    callback([]);
  });
}
