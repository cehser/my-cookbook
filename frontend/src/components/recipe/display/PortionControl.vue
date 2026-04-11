<script setup lang="ts">
const props = defineProps<{
  yieldsValue: number;
  yieldsUnit: string;
  variant: "desktop" | "mobile-collapsed" | "mobile-expanded";
}>();

const emit = defineEmits<{
  "update:yields": [value: number];
}>();

function increase() {
  if (props.yieldsValue < 100) {
    emit("update:yields", props.yieldsValue + 1);
  }
}

function decrease() {
  if (props.yieldsValue > 1) {
    emit("update:yields", props.yieldsValue - 1);
  }
}

function updateValue(value: string) {
  const numValue = Number(value);
  if (numValue >= 1 && numValue <= 100) {
    emit("update:yields", numValue);
  }
}
</script>

<template>
  <!-- Desktop Variant -->
  <div v-if="variant === 'desktop'" class="portions-control-desktop">
    <BButton
      @click="decrease"
      variant="primary"
      size="sm"
      class="portion-btn"
      :disabled="yieldsValue <= 1"
    >
      <i class="bi bi-dash-lg"></i>
    </BButton>

    <div class="portions-display">
      <input
        type="number"
        min="1"
        max="100"
        step="1"
        :value="yieldsValue"
        @input="updateValue(($event.target as HTMLInputElement).value)"
        class="portions-input-desktop"
      />
      <span class="unit">{{ yieldsUnit }}</span>
    </div>

    <BButton @click="increase" variant="primary" size="sm" class="portion-btn">
      <i class="bi bi-plus-lg"></i>
    </BButton>
  </div>

  <!-- Mobile Collapsed Variant -->
  <div
    v-else-if="variant === 'mobile-collapsed'"
    class="portions-control-mobile"
    @click.stop
  >
    <BButton
      @click="decrease"
      class="portion-btn-mobile"
      :disabled="yieldsValue <= 1"
    >
      <i class="bi bi-dash"></i>
    </BButton>
    <input
      type="number"
      min="1"
      max="100"
      step="1"
      :value="yieldsValue"
      @input="updateValue(($event.target as HTMLInputElement).value)"
      class="portions-input-mobile"
    />
    <span class="portions-unit-mobile">{{ yieldsUnit }}</span>
    <BButton @click="increase" class="portion-btn-mobile">
      <i class="bi bi-plus"></i>
    </BButton>
  </div>

  <!-- Mobile Expanded Variant -->
  <div
    v-else-if="variant === 'mobile-expanded'"
    class="portions-control-mobile-expanded"
  >
    <BButton
      @click="decrease"
      variant="primary"
      size="sm"
      class="portion-btn"
      :disabled="yieldsValue <= 1"
    >
      <i class="bi bi-dash-lg"></i>
    </BButton>

    <div class="portions-display-expanded">
      <input
        type="number"
        min="1"
        max="100"
        step="1"
        :value="yieldsValue"
        @input="updateValue(($event.target as HTMLInputElement).value)"
        class="portions-input-expanded"
      />
      <span class="unit">{{ yieldsUnit }}</span>
    </div>

    <BButton @click="increase" variant="primary" size="sm" class="portion-btn">
      <i class="bi bi-plus-lg"></i>
    </BButton>
  </div>
</template>

<style scoped>
/* Desktop Variant */
.portions-control-desktop {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: var(--space-2);
  padding: var(--space-2) var(--space-3);
  background: var(--color-divider);
  border-radius: var(--radius-pill);
  margin-top: var(--space-4);
}

.portion-btn {
  width: var(--action-btn-size-small);
  height: var(--action-btn-size-small);
  min-width: var(--action-btn-size-small);
  padding: 0;
  display: flex;
  align-items: center;
  justify-content: center;
  border-radius: var(--radius-circle);
  border: none;
  flex-shrink: 0;
  transition: all var(--transition-fast);
}

.portion-btn:hover:not(:disabled) {
  transform: scale(1.05);
}

.portions-display {
  display: flex;
  align-items: baseline;
  gap: var(--space-2);
}

.portions-input-desktop {
  width: 50px;
  height: 40px;
  min-width: 40px;
  text-align: center;
  font-size: 1.25rem;
  font-weight: var(--font-weight-semibold);
  border: none;
  background: var(--color-surface-raised);
  border-radius: var(--radius-md);
  padding: var(--space-1);
  -webkit-appearance: none;
  -moz-appearance: textfield;
  appearance: textfield;
}

.portions-input-desktop::-webkit-outer-spin-button,
.portions-input-desktop::-webkit-inner-spin-button {
  -webkit-appearance: none;
  margin: 0;
}

.portions-input-desktop:focus {
  outline: none;
  background: rgba(255, 255, 255, 0.95);
}

.portions-display .unit {
  font-size: var(--font-size-md);
  font-weight: var(--font-weight-medium);
  color: var(--color-text);
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
  max-width: 100px;
}

/* Mobile Collapsed Variant */
.portions-control-mobile {
  display: flex;
  align-items: center;
  gap: var(--space-1);
  padding: var(--space-1) var(--space-2);
  background: var(--color-divider);
  border-radius: var(--radius-pill);
}

.portion-btn-mobile {
  width: 30px;
  height: 30px;
  padding: 0;
  display: flex;
  align-items: center;
  justify-content: center;
  border-radius: var(--radius-circle);
  background: var(--color-primary);
  border: none;
  color: var(--color-text-on-primary);
  font-size: var(--font-size-sm);
}

.portions-input-mobile {
  width: 40px;
  height: 28px;
  text-align: center;
  font-size: var(--font-size-md);
  font-weight: var(--font-weight-semibold);
  border: none;
  background: var(--color-surface-raised);
  border-radius: var(--radius-sm);
  padding: 2px;
  -webkit-appearance: none;
  -moz-appearance: textfield;
  appearance: textfield;
}

.portions-input-mobile::-webkit-outer-spin-button,
.portions-input-mobile::-webkit-inner-spin-button {
  -webkit-appearance: none;
  margin: 0;
}

.portions-input-mobile:focus {
  outline: none;
  background: rgba(255, 255, 255, 0.95);
}

.portions-unit-mobile {
  font-size: var(--font-size-sm);
  font-weight: var(--font-weight-medium);
  flex: 1;
  min-width: 0;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

/* Mobile Expanded Variant */
.portions-control-mobile-expanded {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: var(--space-2);
  padding: var(--space-2) var(--space-4);
  background: var(--color-divider);
  border-radius: var(--radius-pill);
  margin-bottom: var(--space-4);
}

.portions-display-expanded {
  display: flex;
  align-items: baseline;
  gap: var(--space-2);
}

.portions-input-expanded {
  width: 70px;
  height: 44px;
  text-align: center;
  font-size: var(--font-size-xl);
  font-weight: var(--font-weight-semibold);
  border: none;
  background: var(--color-surface-raised);
  border-radius: var(--radius-md);
  padding: var(--space-1);
  -webkit-appearance: none;
  -moz-appearance: textfield;
  appearance: textfield;
}

.portions-input-expanded::-webkit-outer-spin-button,
.portions-input-expanded::-webkit-inner-spin-button {
  -webkit-appearance: none;
  margin: 0;
}

.portions-input-expanded:focus {
  outline: none;
  background: rgba(255, 255, 255, 0.95);
}

.portions-display-expanded .unit {
  font-size: var(--font-size-lg);
  font-weight: var(--font-weight-medium);
  color: var(--color-text);
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
  max-width: 100px;
}

.portions-control-mobile-expanded .portion-btn {
  width: 40px;
  height: 40px;
  border-radius: var(--radius-circle);
}
</style>
