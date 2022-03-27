type TEffect = Function & {
    // 保存所有与该副作用函数相关联的依赖集合
    deps: Set<Function>[];
    options: Partial<EffectOpt>;
  };

type EffectOpt = {
    // 调度器，给用户提供控制副作用函数重新执行的时机、次数等能力
    scheduler: (fn: TEffect) => void;
    // 懒执行
    lazy: Boolean;
  };