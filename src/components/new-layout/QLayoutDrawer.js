import TouchPan from '../../directives/touch-pan'
import { cssTransform } from '../../utils/dom'
import { between } from '../../utils/format'
import { QResizeObservable } from '../observables'

const
  bodyClass = 'with-layout-drawer-opened',
  duration = 120 + 30

export default {
  name: 'q-layout-drawer',
  inject: ['layout', 'history'],
  directives: {
    TouchPan
  },
  props: {
    value: Boolean,
    rightSide: Boolean,
    breakpoint: {
      type: Number,
      default: 992
    }
  },
  data () {
    const belowBreakpoint = this.breakpoint >= this.layout.width
    return {
      belowBreakpoint,
      largeScreenState: this.value,
      mobileOpened: false,

      size: 300,
      inTransit: false,
      position: 0,
      percentage: 0
    }
  },
  watch: {
    value (val) {
      console.log('watcher value', val)
      if (!val && this.mobileOpened) {
        console.log('watcher value: mobile opened; history remove')
        this.history.remove()
        return
      }

      if (val && this.belowBreakpoint) {
        console.log('watcher value: opening mobile')
        this.mobileOpened = true
        this.percentage = 1
        document.body.classList.add(bodyClass)

        this.history.add(() => new Promise((resolve, reject) => {
          this.mobileOpened = false
          this.percentage = 0
          document.body.classList.remove(bodyClass)
          this.__updateModel(this.belowBreakpoint ? false : this.largeScreenState)
          if (typeof this.__onClose === 'function') {
            setTimeout(() => {
              resolve()
              this.__onClose()
              this.__onClose = null
            }, duration)
          }
          else {
            resolve()
          }
        }))
      }

      if (val) {
        console.log('watcher value: calling onshow')
        if (typeof this.__onShow === 'function') {
          this.__onShow()
          this.__onShow = null
        }
        return
      }

      console.log('watcher value: calling onclose')
      if (typeof this.__onClose === 'function') {
        setTimeout(() => {
          this.__onClose()
          this.__onClose = null
        }, duration)
      }
    },
    belowBreakpoint (val, old) {
      console.log('belowBreakpoint: change detected', val)
      if (this.mobileOpened) {
        console.log('belowBreakpoint: mobile view is opened; aborting')
        return
      }

      if (val) { // from lg to xs
        console.log('belowBreakpoint: from lg to xs; largeScreenState set to', this.value, 'model force to false')
        this.largeScreenState = this.value
        // ensure we close it for small screen
        this.__updateModel(false)
      }
      else { // from xs to lg
        console.log('belowBreakpoint: from xs to lg; model set to', this.largeScreenState)
        this.__updateModel(this.largeScreenState)
      }
    },
    breakpoint () {
      this.__updateLocal('belowBreakpoint', this.breakpoint > this.layout.width)
    },
    'layout.width' () {
      this.__updateLocal('belowBreakpoint', this.breakpoint > this.layout.width)
    },
    offset (val) {
      console.log(this.side, 'OFFSET', val)
      this.__update('offset', val)
    },
    onLayout (val) {
      console.log('onLayout', val)
      this.__update('space', val)
      this.layout.__animate()
    }
  },
  computed: {
    side () {
      return this.rightSide ? 'right' : 'left'
    },
    offset () {
      return this.value && !this.mobileOpened
        ? this.size
        : 0
    },
    fixed () {
      return this.layout.view.indexOf(this.rightSide ? 'R' : 'L') > -1
    },
    onLayout () {
      return !this.needsTouch && this.value
    },
    backdropClass () {
      return {
        'transition-generic': !this.inTransit,
        'no-pointer-events': !this.inTransit && !this.value
      }
    },
    needsTouch () {
      return this.belowBreakpoint || this.mobileOpened
    },
    backdropStyle () {
      return { opacity: this.percentage }
    },
    belowClass () {
      return {
        'fixed': true,
        'on-top': this.inTransit || this.value,
        'on-screen': this.value,
        'off-screen': !this.value,
        'transition-generic': !this.inTransit,
        'top-padding': this.fixed || (this.rightSide ? this.layout.rows.top[2] === 'r' : this.layout.rows.top[0] === 'l')
      }
    },
    belowStyle () {
      if (this.inTransit) {
        return cssTransform(`translateX(${this.position}px)`)
      }
    },
    aboveClass () {
      const onLayout = this.onLayout || (this.value && this.overlay)
      return {
        'off-screen': !onLayout,
        'on-screen': onLayout,
        'fixed': this.overlay || this.fixed || !this.onLayout,
        'top-padding': this.fixed || (this.rightSide ? this.layout.rows.top[2] === 'r' : this.layout.rows.top[0] === 'l')
      }
    },
    aboveStyle () {
      const
        view = this.layout.rows,
        css = {}

      if (this.layout.header.space && this.rightSide ? view.top[2] !== 'r' : view.top[0] !== 'l') {
        if (this.fixed) {
          css.top = `${this.layout.header.offset}px`
        }
        else if (this.layout.header.space) {
          css.top = `${this.layout.header.size}px`
        }
      }

      if (this.layout.footer.space && this.rightSide ? view.bottom[2] !== 'r' : view.bottom[0] !== 'l') {
        if (this.fixed) {
          css.bottom = `${this.layout.footer.offset}px`
        }
        else if (this.layout.footer.space) {
          css.bottom = `${this.layout.footer.size}px`
        }
      }

      return css
    },
    computedStyle () {
      return this.needsTouch ? this.belowStyle : this.aboveStyle
    },
    computedClass () {
      return this.needsTouch ? this.belowClass : this.aboveClass
    }
  },
  render (h) {
    console.log(`drawer ${this.side} render`)
    const child = []

    if (this.needsTouch) {
      child.push(h('div', {
        staticClass: `q-layout-drawer-opener fixed-${this.side}`,
        directives: [{
          name: 'touch-pan',
          modifier: { horizontal: true },
          value: this.__openByTouch
        }]
      }))
      child.push(h('div', {
        staticClass: 'fullscreen q-layout-backdrop',
        'class': this.backdropClass,
        style: this.backdropStyle,
        on: { click: this.hide },
        directives: [{
          name: 'touch-pan',
          modifier: { horizontal: true },
          value: this.__closeByTouch
        }]
      }))
    }

    return h('div', { staticClass: 'q-drawer-container' }, child.concat([
      h('aside', {
        staticClass: `q-layout-drawer q-layout-drawer-${this.side} scroll q-layout-transition`,
        'class': this.computedClass,
        style: this.computedStyle,
        directives: this.belowBreakpoint ? [{
          name: 'touch-pan',
          modifier: { horizontal: true },
          value: this.__closeByTouch
        }] : null
      }, [
        this.$slots.default,
        h(QResizeObservable, {
          on: { resize: this.__onResize }
        })
      ])
    ]))
  },
  created () {
    if (this.belowBreakpoint) {
      this.__updateModel(false)
    }
    else if (this.onLayout) {
      this.__update('space', true)
      this.__update('offset', this.offset)
    }
  },
  destroyed () {
    this.__update('size', 0)
    this.__update('space', false)
  },
  methods: {
    __openByTouch (evt) {
      if (!this.belowBreakpoint) {
        return
      }
      const
        width = this.size,
        position = between(evt.distance.x, 0, width)

      if (evt.isFinal) {
        const opened = position >= Math.min(75, width)
        this.inTransit = false
        if (opened) { this.show() }
        else { this.percentage = 0 }
        return
      }

      this.position = this.rightSide
        ? Math.max(width - position, 0)
        : Math.min(0, position - width)

      this.percentage = between(position / width, 0, 1)

      if (evt.isFirst) {
        document.body.classList.add(bodyClass)
        this.inTransit = true
      }
    },
    __closeByTouch (evt) {
      if (!this.mobileOpened) {
        return
      }
      const
        width = this.size,
        position = evt.direction === this.side
          ? between(evt.distance.x, 0, width)
          : 0

      if (evt.isFinal) {
        const opened = Math.abs(position) < Math.min(75, width)
        this.inTransit = false
        if (opened) { this.percentage = 1 }
        else { this.hide() }
        return
      }

      this.position = (this.rightSide ? 1 : -1) * position
      this.percentage = between(1 - position / width, 0, 1)

      if (evt.isFirst) {
        this.inTransit = true
      }
    },
    show (fn) {
      if (this.value === true) {
        console.log('show return first', fn)
        if (typeof fn === 'function') {
          fn()
        }
        return
      }

      this.__onShow = fn
      this.__updateModel(true)
    },
    hide (fn) {
      if (this.value === false) {
        console.log('hide return first', fn)
        if (typeof fn === 'function') {
          fn()
        }
        return
      }

      this.__onClose = fn
      this.__updateModel(false)
    },

    __onResize ({ width }) {
      console.log(this.side, 'width', width)
      this.__update('size', width)
      this.__updateLocal('size', width)
    },
    __updateModel (val) {
      if (this.value !== val) {
        console.log('new model', val)
        this.$emit('input', val)
      }
    },
    __update (prop, val) {
      if (this.layout[this.side][prop] !== val) {
        this.layout[this.side][prop] = val
      }
    },
    __updateLocal (prop, val) {
      if (this[prop] !== val) {
        this[prop] = val
      }
    }
  }
}