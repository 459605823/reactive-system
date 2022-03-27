export const cleanupDeps = (effectFn: TEffect) => {
    // 将该副作用函数从所有依赖集合中删除
    for (const deps of effectFn.deps) {
      deps.delete(effectFn);
    }
    effectFn.deps.length = 0;
  };