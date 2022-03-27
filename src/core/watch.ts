import {effect} from './effect';
import {cleanupDeps} from './utils';

type watchOpt = {
  immediate: boolean;
  flush: 'pre' | 'post' | 'sync';
};

export default function watch(
  source: Function | Object,
  cb: (
    newValue: any,
    oldValue: any,
    onInvalidate: (fn: Function) => void
  ) => void,
  options: Partial<watchOpt> = {}
) {
  let getter: Function;
  const traverse = (value: Record<string, any>, seen = new Set()) => {
    if (typeof value !== 'object' || value === null || seen.has(value)) return;
    // 避免循环引用造成的死循环
    seen.add(value);
    // 递归读取对象的每一个值，建立与副作用函数的联系
    // 当对象任一个属性值改变时，都会触发该watch
    for (const k in value) {
      traverse(value[k], seen);
    }
  };
  if (typeof source === 'function') {
    getter = source;
  } else {
    getter = () => {
      traverse(source);
      return {...source};
    };
  }
  let oldValue: any, newValue: any;
  // 存储用户注册的清除副作用回调函数
  let cleanup: Function;
  // 注册清除副作用回调函数
  const onInvalidate = (fn: Function) => {
    cleanup = fn;
  };
  const job = () => {
    newValue = effectFn();
    // 如果注册了清除副作用回调函数，则清除过期回调
    if (cleanup) {
      cleanup();
    }
    cb(newValue, oldValue, onInvalidate);
    // 更新旧值
    oldValue = newValue;
  };
  const effectFn = effect(() => getter(), {
    lazy: true,
    scheduler: () => {
      // 当flush为post时，将副作用函数放到微任务队列中，实现异步延迟执行
      if (options.flush === 'post') {
        const p = Promise.resolve();
        p.then(job);
      } else {
        job();
      }
    },
  });
  if (options.immediate) {
    // 立即执行时，oldValue为undefined
    job();
  } else {
    // 手动调用副作用函数，拿到getter初始获取到的值
    oldValue = effectFn();
  }
  const stop = () => {
    cleanupDeps(effectFn);
  };
  return stop;
}
