import {messageToWorker} from './message-to-worker.js';

const EVENTS_TO_PROXY = [
  'change',
  'click',
  'focus',
];
let touchStart;
let timeOfLastUserGesture = performance.now() || Date.now();

export function listenForEvents(worker) {
  EVENTS_TO_PROXY.forEach((e) => {
    addEventListener(e, proxyEvent, {capture: true, passive: true});
  });

  /** 
   * Derives {pageX, pageY} coordinates from a mouse or touch event. 
   */
  function getTouch(e) {
    let t = (e.changedTouches && e.changedTouches[0]) || (e.touches && e.touches[0]) || e;
    return t && {pageX: t.pageX, pageY: t.pageY};
  }

  /** 
   * Forward a DOM Event into the Worker as a message 
   */
  function proxyEvent(e) {
    timeOfLastUserGesture = performance.now() || Date.now();

    if (e.type === 'click' && touchStart) {
      return false;
    }

    let event = {type: e.type};
    if (e.target) {
      event.target = e.target.__id;
    }

    // For change events, update worker with new `value` prop.
    // TODO(willchou): Complete support for user input (e.g. input events, other props).
    if (e.type == 'change' && 'value' in e.target) {
      event.__value = e.target.value;
    }

    // Copy properties from `e` to proxied `event`.
    for (let i in e) {
      let v = e[i];
      const typeOfV = typeof v;
      if (typeOfV !== 'object' && typeOfV !== 'function' && i !== i.toUpperCase() && !event.hasOwnProperty(i)) {
        event[i] = v;
      }
    }

    messageToWorker(worker, {type: 'event', event});

    // Recategorize very close touchstart/touchend events as clicks.
    // TODO(willchou): Unnecessary?
    if (e.type === 'touchstart') {
      touchStart = getTouch(e);
    } else if (e.type === 'touchend' && touchStart) {
      let touchEnd = getTouch(e);
      if (touchEnd) {
        let dist = Math.sqrt(Math.pow(touchEnd.pageX - touchStart.pageX, 2) + Math.pow(touchEnd.pageY - touchStart.pageY, 2));
        if (dist < 10) {
          event.type = 'click';
          messageToWorker(worker, {type: 'event', event});
        }
      }
    }
  }

  return _ => timeOfLastUserGesture;
}