import {getNode, createNode} from './nodes.js';

// stores pending DOM changes (MutationRecord objects)
let MUTATION_QUEUE = [];
let pendingMutations = false;

export function mutateDOM(lastGestureTime, mutations) {
  if (__REQUIRE_GESTURE_TO_MUTATE__) {
    // Allow mutations up to 5s after user gesture.
    if ((performance.now() || Date.now()) - lastGestureTime > 5000) {
      return;
    }
  }
  
  // This method appends all mutations to a single array.
  // These mutations are attempted to be cleared out by the sync flush method. (processMutationsSync)
  // Alternatively, there is an Async implementation (processMutationsAsync) using rIC to flush the queue.
  MUTATION_QUEUE = MUTATION_QUEUE.concat(data.mutations);
  if (!pendingMutations) {
    pendingMutations = true;
    // setTimeout(processMutationsSync)
    if (MUTATION_QUEUE.length > 0) {
      requestAnimationFrame(processMutationsSync);
      // requestIdleCallback(processMutationsAsync);
    }
  }
}

// Flush all the MutationRecords from the queue.
function processMutationsSync() {
  let iterator = 0;
  const length = MUTATION_QUEUE.length;

  for (; iterator < length; iterator++) {
    Mutators[MUTATION_QUEUE[iterator].type](MUTATION_QUEUE[iterator]);
  }
  MUTATION_QUEUE.splice(0, length);
  pendingMutations = false;
}

// Attempt to flush & process as many MutationRecords as possible from the queue
function processMutationsAsync(deadline) {
  const start = performance.now();
  const isDeadline = deadline && deadline.timeRemaining;
  const mutationLenth = MUTATION_QUEUE.length;
  let removed = 0;

  for (let mutation of MUTATION_QUEUE) {
    Mutators[mutation.type](mutation);
    removed++;

    if (isDeadline && deadline.timeRemaining() <= 0) {
      // console.warn('RequestIdleCallback timeRemaining <= 0', removed);
      break;
    } else if (!isDeadline && (performance.now() - start) > 1) {
      break;
    } else if (mutation.timestamp - getLastGestureTime() > GESTURE_TO_MUTATION_THRESHOLD) {
      console.warn(`Mutation latency exceeded. Queued until next gesture: `, m);
      break;
    }
  }

  MUTATION_QUEUE.splice(0, removed);
  if (removed < mutationLenth) {
    requestIdleCallback(processMutationsAsync);
  } else {
    pendingMutations = false;
  }
}

const Mutators = {
  childList({target, removedNodes, addedNodes, nextSibling}) {
    let parent = getNode(target);
    if (removedNodes) {
      let iterator = removedNodes.length;
      for (;iterator--;) {
        parent.removeChild(getNode(removedNodes[iterator]));
      }
    }
    if (addedNodes) {
      let iterator = 0;
      let length = addedNodes.length;
  
      for (; iterator < length; iterator++) {
        parent.insertBefore(getNode(addedNodes[iterator]) || createNode(addedNodes[iterator]), nextSibling && getNode(nextSibling) || null);
      }
    }
  },
  attributes(mutation) {
    getNode(mutation.target).setAttribute(mutation.attributeName, mutation.value);
  },
  characterData(mutation) {
    getNode(mutation.target).textContent = mutation.value;
  },
  childList({target, removedNodes, addedNodes, nextSibling}) {
    let parent = getNode(target);
    if (removedNodes) {
      let iterator = removedNodes.length;
      for (;iterator--;) {
        parent.removeChild(getNode(removedNodes[iterator]));
      }
    }
    if (addedNodes) {
      let iterator = 0;
      let length = addedNodes.length;

      for (; iterator < length; iterator++) {
        parent.insertBefore(getNode(addedNodes[iterator]) || createNode(addedNodes[iterator]), nextSibling && getNode(nextSibling) || null);
      }
    }
  },
  properties(mutation) {
    const node = getNode(mutation.target);
    node[mutation.propertyName] = mutation.value;
  }
}