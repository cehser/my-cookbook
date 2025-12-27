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
        @input="updateValue($event.target.value)"
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
      @input="updateValue($event.target.value)"
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
        @input="updateValue($event.target.value)"
        class="portions-input-expanded"
      />
      <span class="unit">{{ yieldsUnit }}</span>
    </div>

    <BButton @click="increase" variant="primary" size="sm" class="portion-btn">
      <i class="bi bi-plus-lg"></i>
    </BButton>
  </div>
</template>

<script>
import { BButton } from "bootstrap-vue-next";

export default {
  name: "PortionControl",
  components: {
    BButton,
  },
  props: {
    yieldsValue: {
      type: Number,
      required: true,
    },
    yieldsUnit: {
      type: String,
      required: true,
    },
    variant: {
      type: String,
      required: true,
      validator: (value) =>
        ["desktop", "mobile-collapsed", "mobile-expanded"].includes(value),
    },
  },
  emits: ["update:yields"],
  methods: {
    increase() {
      if (this.yieldsValue < 100) {
        this.$emit("update:yields", this.yieldsValue + 1);
      }
    },
    decrease() {
      if (this.yieldsValue > 1) {
        this.$emit("update:yields", this.yieldsValue - 1);
      }
    },
    updateValue(value) {
      const numValue = Number(value);
      if (numValue >= 1 && numValue <= 100) {
        this.$emit("update:yields", numValue);
      }
    },
  },
};
</script>

<style scoped>
/* Desktop Variant */
.portions-control-desktop {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 0.5rem;
  padding: 0.5rem 1rem;
  background: rgba(var(--bs-light-rgb), 0.5);
  border-radius: 50px;
  margin-top: 1rem;
}

.portion-btn {
  width: 40px;
  height: 40px;
  padding: 0;
  display: flex;
  align-items: center;
  justify-content: center;
  border-radius: 50%;
  border: none;
  transition: all 0.2s ease;
}

.portion-btn:hover:not(:disabled) {
  transform: scale(1.05);
}

.portions-display {
  display: flex;
  align-items: baseline;
  gap: 0.5rem;
}

.portions-input-desktop {
  width: 60px;
  height: 40px;
  text-align: center;
  font-size: 1.25rem;
  font-weight: 600;
  border: none;
  background: white;
  border-radius: 8px;
  padding: 0.25rem;
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
  font-size: 1rem;
  font-weight: 500;
  color: var(--bs-body-color);
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
  max-width: 100px;
}

/* Mobile Collapsed Variant */
.portions-control-mobile {
  display: flex;
  align-items: center;
  gap: 0.35rem;
  padding: 0.2rem 0.5rem;
  background: rgba(var(--bs-light-rgb), 0.3);
  border-radius: 20px;
}

.portion-btn-mobile {
  width: 30px;
  height: 30px;
  padding: 0;
  display: flex;
  align-items: center;
  justify-content: center;
  border-radius: 50%;
  background: var(--bs-primary);
  border: none;
  color: white;
  font-size: 0.875rem;
}

.portions-input-mobile {
  width: 40px;
  height: 28px;
  text-align: center;
  font-size: 1rem;
  font-weight: 600;
  border: none;
  background: white;
  border-radius: 6px;
  padding: 0.15rem;
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
  font-size: 0.875rem;
  font-weight: 500;
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
  gap: 0.5rem;
  padding: 0.5rem 1rem;
  background: rgba(var(--bs-light-rgb), 0.5);
  border-radius: 50px;
  margin-bottom: 1rem;
}

.portions-display-expanded {
  display: flex;
  align-items: baseline;
  gap: 0.5rem;
}

.portions-input-expanded {
  width: 70px;
  height: 44px;
  text-align: center;
  font-size: 1.5rem;
  font-weight: 600;
  border: none;
  background: white;
  border-radius: 10px;
  padding: 0.35rem;
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
  font-size: 1.1rem;
  font-weight: 500;
  color: var(--bs-body-color);
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
