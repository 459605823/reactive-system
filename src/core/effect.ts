import {cleanupDeps} from './utils';
import state from './store';

// 被操作的代理对象 -> 被操作的字段名 1对1
// weakMap对key是弱引用，不影响垃圾回收，当代理对象没有任何引用了
// 说明用户侧不再需要他了，垃圾回收器就可以对他进行回收
const bucket: WeakMap<
  Object,
  Map<string | number | symbol, Set<TEffect>>
> = new WeakMap();

// 用一个全局变量保存当前的副作用函数
let activeEffect: TEffect | undefined;
// 通过栈解决副作用函数嵌套问题
const effectStack: TEffect[] = [];

// 记录副作用函数
const track = (target: Object, key: string | symbol) => {
  if (!activeEffect || !state.shouldTrack) return;
  // 被操作的字段名 -> 副作用函数 1对多
  let depsMap = bucket.get(target);
  if (!depsMap) {
    bucket.set(target, (depsMap = new Map()));
  }
  let deps = depsMap.get(key);
  if (!deps) {
    depsMap.set(key, (deps = new Set()));
  }
  // 将当前副作用函数保存到对应字段副作用函数集合中
  deps.add(activeEffect);
  // 将该副作用函数集合添加到当前副作用函数deps中
  activeEffect.deps.push(deps);
};

// 查找哪些副作用函数依赖于该属性并执行它们
const trigger = (
  target: Object,
  key: string | symbol,
  type: 'SET' | 'ADD' | 'DELETE',
  newVal?: any
) => {
  const depsMap = bucket.get(target);
  if (!depsMap) return;
  const effectsToRun: Set<TEffect> = new Set();
  // 拿到当前key相关联的所有副作用函数
  const effects = depsMap.get(key);
  // 避免无限循环
  effects &&
    effects.forEach((effectFn) => {
      // 如果触发的副作用函数与当前正在执行的副作用函数相同，则不触发执行
      if (effectFn !== activeEffect) {
        effectsToRun.add(effectFn);
      }
    });
  // 如果改变了数组长度，则需要执行所有索引大于等于新length值元素的副作用函数
  if (Array.isArray(target) && key === 'length') {
    depsMap.forEach((effects, key) => {
      if ((key as number) >= newVal) {
        effects.forEach((effectFn) => {
          if (effectFn !== activeEffect) {
            effectsToRun.add(effectFn);
          }
        });
      }
    });
  }
  // 当目标对象为数组且操作类型为ADD即改变了数组长度时
  // 需要执行所有与length属性相关联的副作用函数
  if (type === 'ADD' && Array.isArray(target)) {
    const lengthEffects = depsMap.get('length');
    lengthEffects &&
      lengthEffects.forEach((effectFn) => {
        if (effectFn !== activeEffect) {
          effectsToRun.add(effectFn);
        }
      });
  }
  // 只有当新增加或者删除属性影响遍历操作时，才重新执行遍历相关副作用函数
  if (type === 'ADD' || type === 'DELETE') {
    // 拿到与ITERATE_KEY遍历操作相关联的所有副作用函数
    const iterateEffects = depsMap.get(state.ITERATE_KEY);
    iterateEffects &&
      iterateEffects.forEach((effectFn) => {
        // 如果触发的副作用函数与当前正在执行的副作用函数相同，则不触发执行
        if (effectFn !== activeEffect) {
          effectsToRun.add(effectFn);
        }
      });
  }
  effectsToRun.forEach((effectFn) => {
    // 如果该副作用函数存在调度器，则调用该调度器
    if (effectFn.options.scheduler) {
      effectFn.options.scheduler(effectFn);
    } else {
      effectFn();
    }
  });
};


function effect(fn: Function, options: Partial<EffectOpt> = {}) {
  const effectFn: TEffect = () => {
    // 在副作用函数执行前，先清除副作用函数与响应式数据之间的联系
    cleanupDeps(effectFn);
    activeEffect = effectFn;
    effectStack.push(effectFn);
    // 在副作用函数执行时，会根据当前情况重新建立与数据的联系
    const res = fn();
    // 在当前副作用函数执行完后（当前对应依赖收集完成后）
    // 将当前副作用函数弹出栈，并把activeEffect还原到之前的值
    effectStack.pop();
    activeEffect = effectStack[effectStack.length - 1];
    return res;
  };
  effectFn.options = options;
  effectFn.deps = [];
  if (!options.lazy) {
    effectFn();
  }
  return effectFn;
}

export {trigger, track, effect};
