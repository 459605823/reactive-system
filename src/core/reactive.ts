import {trigger, track} from './effect';
import state from './store';

// 重写数组方法
const arrayInstrumentations: Record<string, Function> = {};
['includes', 'indexOf', 'lastIndexOf'].forEach((method) => {
  const originMethod = Array.prototype[method as keyof typeof Array.prototype];
  arrayInstrumentations[method] = function (...args: any) {
    let res = originMethod.apply(this, args);
    if (!res) {
      res = originMethod.apply((this as any).raw, args);
    }
    return res;
  };
});
// 由于数组的push等方法即会读取length属性也会设置length属性，导致副作用函数互相影响
// 所以要屏蔽掉这些操作对length属性的读取，避免建立响应联系
['push', 'pop', 'shift', 'unshift', 'splice'].forEach((method) => {
  const originMethod = Array.prototype[method as keyof typeof Array.prototype];
  arrayInstrumentations[method] = function (...args: any) {
    state.shouldTrack = false;
    const res = originMethod.apply(this, args);
    state.shouldTrack = true;
    return res;
  };
});

const mutableInstrumentations: Record<string, Function> = {
  add(key: any) {
    // this为代理对象，通过raw获取原始对象
    const target = (this as Record<string | symbol, any>).raw
    const hadKey = target.has(key)
    const res = target.add(key)
    if (!hadKey) {
      trigger(target, key, 'ADD')
    }
    return res
  },
  delete(key: any) {
    const target = (this as Record<string | symbol, any>).raw
    const hadKey = target.has(key)
    const res = target.delete(key)
    if (hadKey) {
      trigger(target, key, 'DELETE')
    }
    return res
  }
}

function createReactive(
  obj: Record<string | symbol, any>,
  isShallow = false,
  isReadonly = false
) {
  // 代理对象拦截所有读取操作
  const proxyHandler: ProxyHandler<Record<string | symbol, any>> = {
    // 1. 访问属性 originData.a
    get(target, key, receiver) {
      // 代理对象可以通过raw属性访问原始数据
      if (key === 'raw') {
        return target;
      }
      if (key === 'size') {
        track(target, state.ITERATE_KEY)
        return Reflect.get(target, key, target)
      }
      // 重写数组方法
      if (
        Array.isArray(target) &&
        Object.prototype.hasOwnProperty.call(arrayInstrumentations, key)
      ) {
        return Reflect.get(arrayInstrumentations, key, receiver);
      }
      // 当为只读属性时说明该属性不会变化，则不用建立响应联系
      // 不追踪类型为symbol的key
      if (!isReadonly && typeof key !== 'symbol') {
        track(target, key);
      }
      const result = Reflect.get(target, key, receiver);
      // 如果是浅响应，则直接返回原始值
      if (isShallow) {
        return result;
      }
      // 如果属性值是对象，则递归将其包装成响应式数据返回
      if (result && typeof result === 'object') {
        return isReadonly ? readonly(result) : reactive(result);
      }
      return result;
    },
    // 2. 判断对象或原型上是否存在给定的key: key in originData
    has(target, key) {
      track(target, key);
      return Reflect.has(target, key);
    },
    // 3. 使用for..in遍历循环对象
    ownKeys(target) {
      // 遍历操作对象没有对应具体的属性key，所以将副作用函数与ITERATE_KEY关联
      // 当对象为数组时，会影响遍历操作的为length属性, 所以将副作用函数与Length关联
      track(target, Array.isArray(target) ? 'length' : state.ITERATE_KEY);
      return Reflect.ownKeys(target);
    },
    // 4. 删除属性
    deleteProperty(target, key) {
      if (isReadonly) {
        console.warn(`属性 ${String(key)} 是只读的`);
        return true;
      }
      const hasKey = Object.prototype.hasOwnProperty.call(target, key);
      const result = Reflect.deleteProperty(target, key);
      // 当删除成功后，才触发副作用函数重新执行
      if (result && hasKey) {
        trigger(target, key, 'DELETE');
      }
      return result;
    },
    set(target, key, newVal, receiver) {
      if (isReadonly) {
        console.warn(`属性 ${String(key)} 是只读的`);
        return true;
      }
      const oldVal = target[key];
      // 判断是添加新属性还是修改已有属性值
      // 如果代理对象是数组，检测被设置的索引值是否小于数组长度，小于的话为SET否则为ADD
      const type = Array.isArray(target)
        ? Number(key) < target.length
          ? 'SET'
          : 'ADD'
        : Object.prototype.hasOwnProperty.call(target, key)
        ? 'SET'
        : 'ADD';
      const result = Reflect.set(target, key, newVal, receiver);
      // receiver为setter调用时的this值，即当前改变的proxy实例
      // 当target与receiver.raw相等时说明receiver是target的代理对象
      // 只有改变的是当前proxy实例并且新值和旧值不相等且都不是NaN的时候才触发响应
      if (
        target === receiver.raw &&
        oldVal !== newVal &&
        (oldVal === oldVal || newVal === newVal)
      ) {
        trigger(target, key, type, newVal);
      }
      return result;
    },
  };
  return new Proxy(obj, proxyHandler);
}

const reactiveMap = new Map();

export function reactive(obj: Record<string | symbol, any>) {
  // 避免为同一个原始对象多次创建代理对象
  const existionProxy = reactiveMap.get(obj);
  if (existionProxy) return existionProxy;
  const proxy = createReactive(obj);
  reactiveMap.set(obj, proxy);
  return proxy;
}

export function shallowReactive(obj: Record<string | symbol, any>) {
  return createReactive(obj, true);
}

export function readonly(obj: Record<string | symbol, any>) {
  return createReactive(obj, false, true);
}

export function shallowReadonly(obj: Record<string | symbol, any>) {
  return createReactive(obj, true, true);
}
