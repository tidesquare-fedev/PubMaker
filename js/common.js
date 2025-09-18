// 공통 유틸리티 함수들

// Helper: copy text with CRLF newlines using Clipboard API with fallback
function copyWithCRLF(text, onSuccess, onError) {
  const crlfText = text.replace(/\r?\n/g, "\r\n");
  const fallbackCopy = () => {
    try {
      const ta = document.createElement("textarea");
      ta.value = crlfText;
      ta.style.position = "fixed";
      ta.style.top = "-1000px";
      ta.setAttribute("readonly", "");
      document.body.appendChild(ta);
      ta.select();
      document.execCommand("copy");
      document.body.removeChild(ta);
      if (onSuccess) onSuccess();
    } catch (e) {
      if (onError) onError(e);
    }
  };

  if (navigator.clipboard && navigator.clipboard.writeText) {
    navigator.clipboard
      .writeText(crlfText)
      .then(() => {
        if (onSuccess) onSuccess();
      })
      .catch(() => {
        fallbackCopy();
      });
  } else {
    fallbackCopy();
  }
}

// 공통 유틸: HEX 정규화/세팅/변환
function normalizeHex(input, loose = false) {
  if (!input) return loose ? null : "#FFFFFF";
  let v = input.trim().replace(/^#/, "");
  if (v.length === 3)
    v = v
      .split("")
      .map((c) => c + c)
      .join("");
  v = v.toUpperCase();
  if (/^[0-9A-F]{6}$/.test(v)) return "#" + v;
  return loose ? null : "#FFFFFF";
}

function setRowBgColor(row, hex) {
  const norm = normalizeHex(hex) || "#FFFFFF";
  const colorInput = row.querySelector(".bg-color");
  const textInput = row.querySelector(".bg-color-text");
  if (colorInput) colorInput.value = norm;
  if (textInput) textInput.value = norm;
}

function rgbToHex(r, g, b) {
  return (
    "#" +
    [r, g, b]
      .map((n) => Math.max(0, Math.min(255, n)).toString(16).padStart(2, "0"))
      .join("")
      .toUpperCase()
  );
}

// Tab switching functionality
function setupTabSwitching() {
  const tabButtons = document.querySelectorAll(".tab-btn");
  const tabContents = document.querySelectorAll(".tab-content");

  tabButtons.forEach((button) => {
    button.addEventListener("click", () => {
      const tabId = button.getAttribute("data-tab");

      // Update active tab button
      tabButtons.forEach((btn) => {
        btn.classList.remove("active");
        btn.classList.add("text-gray-500", "hover:text-gray-700");
        btn.classList.remove("text-blue-600");
      });
      button.classList.add("active", "text-blue-600");
      button.classList.remove("text-gray-500", "hover:text-gray-700");

      // Show selected tab content
      tabContents.forEach((content) => {
        if (content.id === `${tabId}-tab`) {
          content.classList.remove("hidden");
        } else {
          content.classList.add("hidden");
        }
      });
    });
  });
}

// Initialize the app when DOM is loaded
document.addEventListener("DOMContentLoaded", () => {
  setupTabSwitching();
});
