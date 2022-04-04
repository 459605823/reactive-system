import {effect, computed, watch, ref, reactive, toRefs} from 'core/index'

const a = reactive({foo: 1, bar: 2})
const b = toRefs(a)
const c = computed(() => b.foo + 3)
watch(() => b.foo, (val, oldVal) => {
  console.log(val)
  console.log(oldVal)
  console.log(c.value)
})

effect(() => {
  console.log(b.foo)
})

setTimeout(() => {
  b.foo = 3
}, 2000)


