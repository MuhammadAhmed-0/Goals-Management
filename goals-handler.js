import { createGoal, updateGoal, deleteGoal, subscribeToGoals } from './goals-service.js';

let unsubscribeGoals = null;

document.addEventListener('DOMContentLoaded', () => {
  setupGoalsForms();
  initializeGoalsSubscription();
});

function setupGoalsForms() {
  const addGoalForm = document.getElementById('add-goal-form');
  const showAddGoalBtn = document.getElementById('show-add-goal');
  const cancelAddGoalBtn = document.getElementById('cancel-add-goal');
  const addGoalSection = document.getElementById('add-goal-section');

  if (addGoalForm) {
    addGoalForm.addEventListener('submit', handleAddGoal);
  }

  if (showAddGoalBtn) {
    showAddGoalBtn.addEventListener('click', () => {
      addGoalSection.style.display = 'block';
      showAddGoalBtn.style.display = 'none';
    });
  }

  if (cancelAddGoalBtn) {
    cancelAddGoalBtn.addEventListener('click', () => {
      addGoalSection.style.display = 'none';
      showAddGoalBtn.style.display = 'block';
      addGoalForm.reset();
    });
  }
}

function initializeGoalsSubscription() {
  const currentUser = window.getCurrentUser();
  if (currentUser && !unsubscribeGoals) {
    unsubscribeGoals = subscribeToGoals(currentUser.uid, displayGoals);
  }

  const checkInterval = setInterval(() => {
    const user = window.getCurrentUser();
    if (user && !unsubscribeGoals) {
      unsubscribeGoals = subscribeToGoals(user.uid, displayGoals);
      clearInterval(checkInterval);
    }
  }, 500);
}

async function handleAddGoal(e) {
  e.preventDefault();
  const currentUser = window.getCurrentUser();
  if (!currentUser) {
    window.showMessage('You must be logged in to add goals', 'error');
    return;
  }

  const title = document.getElementById('goal-title').value;
  const description = document.getElementById('goal-description').value;
  const targetDate = document.getElementById('goal-target-date').value;

  const result = await createGoal(currentUser.uid, {
    title,
    description,
    targetDate
  });

  if (result.success) {
    window.showMessage('Goal added successfully!', 'success');
    e.target.reset();
    document.getElementById('add-goal-section').style.display = 'none';
    document.getElementById('show-add-goal').style.display = 'block';
  } else {
    window.showMessage(result.error, 'error');
  }
}

function displayGoals(goals) {
  const goalsContainer = document.getElementById('goals-list');
  if (!goalsContainer) return;

  if (goals.length === 0) {
    goalsContainer.innerHTML = '<p class="no-goals">No goals yet. Add your first goal to get started!</p>';
    return;
  }

  goalsContainer.innerHTML = goals.map(goal => createGoalCard(goal)).join('');

  goals.forEach(goal => {
    const progressSlider = document.getElementById(`progress-${goal.id}`);
    const deleteBtn = document.getElementById(`delete-${goal.id}`);
    const completeBtn = document.getElementById(`complete-${goal.id}`);

    if (progressSlider) {
      progressSlider.addEventListener('input', (e) => updateGoalProgress(goal.id, e.target.value));
    }

    if (deleteBtn) {
      deleteBtn.addEventListener('click', () => handleDeleteGoal(goal.id));
    }

    if (completeBtn) {
      completeBtn.addEventListener('click', () => handleCompleteGoal(goal.id, goal.status));
    }
  });
}

function createGoalCard(goal) {
  const targetDate = goal.targetDate ? new Date(goal.targetDate).toLocaleDateString() : 'No deadline';
  const isCompleted = goal.status === 'completed';
  const progress = goal.progress || 0;

  return `
    <div class="goal-card ${isCompleted ? 'completed' : ''}">
      <div class="goal-header">
        <h3>${goal.title}</h3>
        <span class="goal-status ${goal.status}">${goal.status}</span>
      </div>
      <p class="goal-description">${goal.description}</p>
      <div class="goal-meta">
        <span>Target: ${targetDate}</span>
      </div>
      <div class="progress-section">
        <label>Progress: <span id="progress-value-${goal.id}">${progress}%</span></label>
        <input
          type="range"
          id="progress-${goal.id}"
          min="0"
          max="100"
          value="${progress}"
          ${isCompleted ? 'disabled' : ''}
        />
        <div class="progress-bar">
          <div class="progress-fill" style="width: ${progress}%"></div>
        </div>
      </div>
      <div class="goal-actions">
        <button id="complete-${goal.id}" class="btn btn-success" ${isCompleted ? 'disabled' : ''}>
          ${isCompleted ? 'Completed' : 'Mark Complete'}
        </button>
        <button id="delete-${goal.id}" class="btn btn-danger">Delete</button>
      </div>
    </div>
  `;
}

async function updateGoalProgress(goalId, progress) {
  const progressValue = document.getElementById(`progress-value-${goalId}`);
  if (progressValue) {
    progressValue.textContent = `${progress}%`;
  }

  await updateGoal(goalId, { progress: parseInt(progress) });
}

async function handleDeleteGoal(goalId) {
  if (confirm('Are you sure you want to delete this goal?')) {
    const result = await deleteGoal(goalId);
    if (result.success) {
      window.showMessage('Goal deleted successfully!', 'success');
    } else {
      window.showMessage(result.error, 'error');
    }
  }
}

async function handleCompleteGoal(goalId, currentStatus) {
  const newStatus = currentStatus === 'completed' ? 'active' : 'completed';
  const progress = newStatus === 'completed' ? 100 : 0;

  const result = await updateGoal(goalId, {
    status: newStatus,
    progress: progress
  });

  if (result.success) {
    window.showMessage(`Goal ${newStatus === 'completed' ? 'completed' : 'reactivated'}!`, 'success');
  } else {
    window.showMessage(result.error, 'error');
  }
}
