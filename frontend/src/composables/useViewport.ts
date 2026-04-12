import { computed } from "vue";
import { useWindowSize } from "@vueuse/core";

export function useViewport() {
  const { width: windowWidth, height: windowHeight } = useWindowSize();

  const isMobile = computed(() => windowWidth.value < 768);
  const isTablet = computed(
    () => windowWidth.value >= 768 && windowWidth.value < 1024,
  );
  const isDesktop = computed(() => windowWidth.value >= 1024);
  const isDesktopOrTablet = computed(() => windowWidth.value >= 768);
  const isPortrait = computed(() => windowHeight.value > windowWidth.value);
  const isLandscape = computed(() => windowWidth.value > windowHeight.value);

  return {
    windowWidth,
    windowHeight,
    isMobile,
    isTablet,
    isDesktop,
    isDesktopOrTablet,
    isPortrait,
    isLandscape,
  };
}
