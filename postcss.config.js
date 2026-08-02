export default {
  plugins: {
    // Inlines the design-system CSS before Tailwind runs, so `@layer base` and
    // `@layer components` in those files resolve against index.css's
    // `@tailwind` directives.
    "postcss-import": {},
    tailwindcss: {},
    autoprefixer: {},
  },
};
