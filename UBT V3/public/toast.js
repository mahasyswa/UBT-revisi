/**
 * Toast Notification System
 * Beautiful, modern toast notifications for all user actions
 */

class ToastNotification {
  constructor() {
    this.container = null;
    this.init();
  }

  init() {
    // Create toast container if not exists
    if (!document.querySelector('.toast-container')) {
      this.container = document.createElement('div');
      this.container.className = 'toast-container';
      document.body.appendChild(this.container);
    } else {
      this.container = document.querySelector('.toast-container');
    }
  }

  /**
   * Show a toast notification
   * @param {string} type - success, error, warning, info
   * @param {string} title - Toast title
   * @param {string} message - Toast message
   * @param {number} duration - Duration in milliseconds (0 = no auto-hide)
   */
  show(type = 'info', title = '', message = '', duration = 5000) {
    const toast = this.createToast(type, title, message, duration);
    this.container.appendChild(toast);

    // Auto-remove after duration
    if (duration > 0) {
      setTimeout(() => {
        this.hide(toast);
      }, duration);
    }

    return toast;
  }

  createToast(type, title, message, duration) {
    const toast = document.createElement('div');
    toast.className = `toast ${type}`;

    // Icon based on type
    const icons = {
      success: '✓',
      error: '✕',
      warning: '⚠',
      info: 'ℹ'
    };

    const icon = icons[type] || icons.info;

    toast.innerHTML = `
      <div class="toast-icon">${icon}</div>
      <div class="toast-content">
        <div class="toast-title">${title}</div>
        ${message ? `<div class="toast-message">${message}</div>` : ''}
      </div>
      <button class="toast-close" aria-label="Close">×</button>
      ${duration > 0 ? `<div class="toast-progress" style="animation-duration: ${duration}ms"></div>` : ''}
    `;

    // Close button handler
    const closeBtn = toast.querySelector('.toast-close');
    closeBtn.addEventListener('click', () => {
      this.hide(toast);
    });

    return toast;
  }

  hide(toast) {
    toast.classList.add('hiding');
    setTimeout(() => {
      if (toast.parentNode) {
        toast.parentNode.removeChild(toast);
      }
    }, 300);
  }

  // Convenience methods
  success(title, message = '', duration = 5000) {
    return this.show('success', title, message, duration);
  }

  error(title, message = '', duration = 7000) {
    return this.show('error', title, message, duration);
  }

  warning(title, message = '', duration = 6000) {
    return this.show('warning', title, message, duration);
  }

  info(title, message = '', duration = 5000) {
    return this.show('info', title, message, duration);
  }

  // Clear all toasts
  clearAll() {
    const toasts = this.container.querySelectorAll('.toast');
    toasts.forEach(toast => this.hide(toast));
  }
}

// Initialize toast globally
window.toast = new ToastNotification();

// Helper functions for common scenarios
window.showSuccessToast = (title, message = '', duration = 5000) => {
  window.toast.success(title, message, duration);
};

window.showErrorToast = (title, message = '', duration = 7000) => {
  window.toast.error(title, message, duration);
};

window.showWarningToast = (title, message = '', duration = 6000) => {
  window.toast.warning(title, message, duration);
};

window.showInfoToast = (title, message = '', duration = 5000) => {
  window.toast.info(title, message, duration);
};

// Auto-show toast from URL parameters (for server redirects)
document.addEventListener('DOMContentLoaded', () => {
  const urlParams = new URLSearchParams(window.location.search);
  
  // Success message
  const success = urlParams.get('success');
  if (success) {
    showSuccessToast('Berhasil!', decodeURIComponent(success));
    // Clean URL
    window.history.replaceState({}, document.title, window.location.pathname);
  }

  // Error message
  const error = urlParams.get('error');
  if (error) {
    showErrorToast('Error!', decodeURIComponent(error));
    // Clean URL
    window.history.replaceState({}, document.title, window.location.pathname);
  }

  // Warning message
  const warning = urlParams.get('warning');
  if (warning) {
    showWarningToast('Peringatan!', decodeURIComponent(warning));
    // Clean URL
    window.history.replaceState({}, document.title, window.location.pathname);
  }

  // Info message
  const info = urlParams.get('info');
  if (info) {
    showInfoToast('Info', decodeURIComponent(info));
    // Clean URL
    window.history.replaceState({}, document.title, window.location.pathname);
  }
});

// Intercept form submissions to show loading toast
document.addEventListener('submit', (e) => {
  if (e.target.tagName === 'FORM' && !e.target.hasAttribute('data-no-toast')) {
    const submitBtn = e.target.querySelector('button[type="submit"]');
    if (submitBtn) {
      const originalText = submitBtn.textContent;
      submitBtn.disabled = true;
      submitBtn.textContent = 'Memproses...';
      
      // Show loading toast
      showInfoToast('Memproses...', 'Mohon tunggu sebentar', 0);
    }
  }
});

// Intercept AJAX responses for automatic toast notifications
if (window.fetch) {
  const originalFetch = window.fetch;
  window.fetch = function(...args) {
    return originalFetch.apply(this, args).then(response => {
      // Check for success/error headers or response data
      if (response.ok) {
        const contentType = response.headers.get('content-type');
        if (contentType && contentType.includes('application/json')) {
          response.clone().json().then(data => {
            if (data.success && data.message) {
              showSuccessToast('Berhasil!', data.message);
            } else if (data.error) {
              showErrorToast('Error!', data.error);
            }
          }).catch(() => {});
        }
      } else if (response.status >= 400) {
        response.clone().json().then(data => {
          showErrorToast('Error!', data.error || data.message || 'Terjadi kesalahan');
        }).catch(() => {
          showErrorToast('Error!', `HTTP ${response.status}: ${response.statusText}`);
        });
      }
      return response;
    });
  };
}

console.log('✨ Toast Notification System loaded');
