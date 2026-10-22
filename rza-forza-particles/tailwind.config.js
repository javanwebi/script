/** @type {import('tailwindcss').Config} */
module.exports = {
  content: ["./index.html", "./src/**/*.{js,jsx}"],
  theme: {
    extend: {
      fontFamily: { display: ['"RZA Display"', "sans-serif"], fa: ['"RZA Fa"', "Tahoma", "sans-serif"] },
      colors: { char: "#080402", soot: "#1a0d06", fire: "#ff6a00", ember: "#ff8a2a", molten: "#ffd9b0", ash: "#fff1e0" },
    },
  },
};
