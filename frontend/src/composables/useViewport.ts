import { ref, onMounted, onUnmounted, computed } from 'vue'

export function useViewport() {
  const windowWidth = ref(window.innerWidth)
  const windowHeight = ref(window.innerHeight)
  
  const isMobile = computed(() => windowWidth.value < 768)
  const isTablet = computed(() => windowWidth.value >= 768 && windowWidth.value < 1024)
  const isDesktop = computed(() => windowWidth.value >= 1024)
  const isDesktopOrTablet = computed(() => windowWidth.value >= 768)
  
  // Portrait vs Landscape (für Sprint 2)
  const isPortrait = computed(() => windowHeight.value > windowWidth.value)
  const isLandscape = computed(() => windowWidth.value > windowHeight.value)
  
  const updateViewport = () => {
    windowWidth.value = window.innerWidth
    windowHeight.value = window.innerHeight
  }
  
  onMounted(() => {
    window.addEventListener('resize', updateViewport)
    window.addEventListener('orientationchange', updateViewport)
  })
  
  onUnmounted(() => {
    window.removeEventListener('resize', updateViewport)
    window.removeEventListener('orientationchange', updateViewport)
  })
  
  return {
    windowWidth,
    windowHeight,
    isMobile,
    isTablet,
    isDesktop,
    isDesktopOrTablet,
    isPortrait,
    isLandscape
  }
}
