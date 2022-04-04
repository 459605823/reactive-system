import {effect} from 'core/effect'
import {ref, reactive, toRefs} from 'core/reactive'

const a = reactive({foo: 1, bar: 2})
const b = toRefs(a)

effect(() => {
  console.log(b.foo)
})

setTimeout(() => {
  b.foo = 3
}, 2000)


