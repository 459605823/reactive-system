import {effect, track, trigger} from './effect';

// 计算属性
export default function computed(getter: Function) {
  // 缓存上一次计算的值
  let value: any;
  // 标记是否需要重新计算值
  let dirty = true;
  const effectFn = effect(getter, {
    lazy: true,
    scheduler: () => {
      if (!dirty) {
        // 当计算属性依赖的响应式数据变化时，手动调用trigger触发响应
        // 并改变dirty使computed可以获取到更新后的值
        dirty = true;
        trigger(obj, 'value', 'SET');
      }
    },
  });
  const obj = {
    get value() {
      if (dirty) {
        // 将dirty设为false, 下次访问直接使用缓存的值
        dirty = false;
        value = effectFn();
      }
      // 读取value时，手动调用track进行追踪
      track(obj, 'value');
      return value;
    },
  };
  return obj;
}
