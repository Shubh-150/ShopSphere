// ========================================
// ShopSphere - Smart E-Commerce Platform
// SWYNEX Internship Task 4
// ========================================

const API_URL = "https://fakestoreapi.com/products";

// DOM Elements
const $ = (selector) => document.querySelector(selector);

const productGrid = $("#productGrid");
const searchInput = $("#searchInput");
const categoryFilter = $("#categoryFilter");
const sortFilter = $("#sortFilter");
const resultsCount = $("#resultsCount");
const errorMessage = $("#errorMessage");
const emptyMessage = $("#emptyMessage");

let products = [];
let cart = loadStorage("shopsphere-cart", {});
let wishlist = loadStorage("shopsphere-wishlist", []);
let toastTimer;

// ========================================
// LOCAL STORAGE
// ========================================

function loadStorage(key, fallback) {
    try {
        const saved = localStorage.getItem(key);

        return saved ? JSON.parse(saved) : fallback;
    } catch (error) {
        console.warn("Storage loading failed:", error);
        return fallback;
    }
}

function saveStorage() {
    try {
        localStorage.setItem(
            "shopsphere-cart",
            JSON.stringify(cart)
        );

        localStorage.setItem(
            "shopsphere-wishlist",
            JSON.stringify(wishlist)
        );
    } catch (error) {
        console.warn("Storage saving failed:", error);
        showToast("Could not save data in this browser.");
    }
}

// ========================================
// HELPER FUNCTIONS
// ========================================

function escapeHTML(value) {
    return String(value).replace(/[&<>"']/g, (character) => ({
        "&": "&amp;",
        "<": "&lt;",
        ">": "&gt;",
        '"': "&quot;",
        "'": "&#39;"
    })[character]);
}

function formatPrice(price) {
    return new Intl.NumberFormat("en-US", {
        style: "currency",
        currency: "USD"
    }).format(price);
}

function showToast(message) {
    const toast = $("#toast");

    if (!toast) return;

    toast.textContent = message;
    toast.classList.add("show");

    clearTimeout(toastTimer);

    toastTimer = setTimeout(() => {
        toast.classList.remove("show");
    }, 2500);
}

function getCartCount() {
    return Object.values(cart).reduce(
        (total, quantity) => total + quantity,
        0
    );
}

function getCartTotal() {
    return Object.entries(cart).reduce(
        (total, [id, quantity]) => {
            const product = products.find(
                item => item.id === Number(id)
            );

            if (!product) return total;

            return total + product.price * quantity;
        },
        0
    );
}

// ========================================
// ANALYTICS
// ========================================

function updateAnalytics() {
    const categoryCount = new Set(
        products.map(product => product.category)
    ).size;

    $("#cartCount").textContent = getCartCount();
    $("#wishlistCount").textContent = wishlist.length;

    $("#totalProducts").textContent = products.length;
    $("#totalCategories").textContent = categoryCount;

    $("#analyticsCart").textContent = getCartCount();
    $("#analyticsWishlist").textContent = wishlist.length;

    $("#heroProductCount").textContent =
        products.length + "+";

    $("#heroCategoryCount").textContent =
        categoryCount;
}

// ========================================
// LOAD CATEGORIES
// ========================================

function renderCategories() {
    const previousValue = categoryFilter.value;

    categoryFilter.innerHTML =
        '<option value="all">All Categories</option>';

    const categories = [
        ...new Set(products.map(product => product.category))
    ];

    categories.forEach(category => {
        const option = document.createElement("option");

        option.value = category;

        option.textContent =
            category.charAt(0).toUpperCase() +
            category.slice(1);

        categoryFilter.appendChild(option);
    });

    if (categories.includes(previousValue)) {
        categoryFilter.value = previousValue;
    }
}

// ========================================
// LOADING STATE
// ========================================

function showLoading() {
    productGrid.hidden = false;
    errorMessage.hidden = true;
    emptyMessage.hidden = true;

    productGrid.innerHTML = `
        <div class="loading-state">
            <div class="spinner"></div>
            <p>Discovering amazing products...</p>
        </div>
    `;

    resultsCount.textContent = "Loading products...";
}

// ========================================
// ERROR STATE
// ========================================

function showError(message) {
    productGrid.innerHTML = "";
    productGrid.hidden = true;

    emptyMessage.hidden = true;
    errorMessage.hidden = false;

    resultsCount.textContent = message;
}

// ========================================
// FETCH PRODUCTS FROM API
// ========================================

async function fetchProducts() {
    showLoading();

    try {
        const response = await fetch(API_URL, {
            signal: AbortSignal.timeout(20000)
        });

        if (!response.ok) {
            throw new Error(
                "API request failed with status " +
                response.status
            );
        }

        const data = await response.json();

        if (!Array.isArray(data)) {
            throw new Error("Invalid product data received.");
        }

        products = data.filter(product => {
            return (
                Number.isFinite(product.id) &&
                typeof product.title === "string" &&
                Number.isFinite(product.price) &&
                typeof product.description === "string" &&
                typeof product.category === "string" &&
                typeof product.image === "string" &&
                product.rating &&
                Number.isFinite(product.rating.rate) &&
                Number.isFinite(product.rating.count)
            );
        });

        if (products.length === 0) {
            throw new Error("No valid products received.");
        }

        // Remove invalid IDs from saved data.
        const validIds = new Set(
            products.map(product => product.id)
        );

        wishlist = wishlist.filter(
            id => validIds.has(id)
        );

        Object.keys(cart).forEach(id => {
            const quantity = cart[id];

            if (
                !validIds.has(Number(id)) ||
                !Number.isInteger(quantity) ||
                quantity <= 0
            ) {
                delete cart[id];
            }
        });

        saveStorage();

        renderCategories();
        renderProducts();
        updateAnalytics();

        console.log(
            "ShopSphere: Successfully loaded",
            products.length,
            "products."
        );

    } catch (error) {
        console.error("ShopSphere API Error:", error);

        let message =
            "Unable to load products. Please try again.";

        if (error.name === "TimeoutError") {
            message =
                "The request took too long. Please try again.";
        } else if (!navigator.onLine) {
            message =
                "You appear to be offline. Check your internet connection.";
        }

        showError(message);
    }
}

// ========================================
// RENDER PRODUCTS
// ========================================

function renderProducts() {
    const query = searchInput.value
        .trim()
        .toLowerCase();

    const category = categoryFilter.value;
    const sort = sortFilter.value;

    let filteredProducts = products.filter(product => {
        const matchesSearch =
            product.title.toLowerCase().includes(query) ||
            product.description.toLowerCase().includes(query) ||
            product.category.toLowerCase().includes(query);

        const matchesCategory =
            category === "all" ||
            product.category === category;

        return matchesSearch && matchesCategory;
    });

    // Sorting
    if (sort === "low") {
        filteredProducts.sort(
            (a, b) => a.price - b.price
        );
    } else if (sort === "high") {
        filteredProducts.sort(
            (a, b) => b.price - a.price
        );
    } else if (sort === "rating") {
        filteredProducts.sort(
            (a, b) => b.rating.rate - a.rating.rate
        );
    }

    resultsCount.textContent =
        `Showing ${filteredProducts.length} of ${products.length} products`;

    if (filteredProducts.length === 0) {
        productGrid.innerHTML = "";
        productGrid.hidden = true;

        emptyMessage.hidden = false;

        updateAnalytics();

        return;
    }

    productGrid.hidden = false;
    emptyMessage.hidden = true;
    errorMessage.hidden = true;

    productGrid.innerHTML = filteredProducts.map(product => {
        const isFavorite =
            wishlist.includes(product.id);

        return `
            <article class="product-card">

                <div class="product-image-wrap">

                    <img
                        class="product-image"
                        src="${escapeHTML(product.image)}"
                        alt="${escapeHTML(product.title)}"
                        loading="lazy"
                    >

                    <button
                        class="wishlist-toggle ${isFavorite ? "active" : ""}"
                        data-action="wishlist"
                        data-id="${product.id}"
                        aria-label="Toggle wishlist"
                        aria-pressed="${isFavorite}"
                    >
                        ${isFavorite ? "♥" : "♡"}
                    </button>

                </div>

                <span class="product-category">
                    ${escapeHTML(product.category)}
                </span>

                <div class="product-info">

                    <h3 class="product-title">
                        ${escapeHTML(product.title)}
                    </h3>

                    <p class="product-rating">
                        ★ ${product.rating.rate.toFixed(1)}
                        <span>
                            (${product.rating.count} reviews)
                        </span>
                    </p>

                    <div class="product-bottom">

                        <span class="product-price">
                            ${formatPrice(product.price)}
                        </span>

                        <button
                            class="add-cart"
                            data-action="add"
                            data-id="${product.id}"
                        >
                            + Add
                        </button>

                    </div>

                </div>

            </article>
        `;
    }).join("");

    updateAnalytics();
}

// ========================================
// ADD TO CART
// ========================================

function addToCart(id) {
    const product = products.find(
        item => item.id === id
    );

    if (!product) return;

    cart[id] = (cart[id] || 0) + 1;

    saveStorage();
    updateAnalytics();

    showToast("Product added to cart! 🛒");
}

// ========================================
// WISHLIST
// ========================================

function toggleWishlist(id) {
    if (wishlist.includes(id)) {
        wishlist = wishlist.filter(
            item => item !== id
        );

        showToast("Removed from wishlist.");
    } else {
        wishlist.push(id);

        showToast("Added to wishlist! ❤️");
    }

    saveStorage();
    updateAnalytics();
    renderProducts();
}

// ========================================
// RENDER CART
// ========================================

function renderCart() {
    const container = $("#cartItems");

    const cartEntries = Object.entries(cart).filter(
        ([id, quantity]) =>
            products.some(
                product => product.id === Number(id)
            ) &&
            Number.isInteger(quantity) &&
            quantity > 0
    );

    if (cartEntries.length === 0) {
        container.innerHTML = `
            <p class="empty-list">
                Your cart is empty.
                Explore products and add your favorites!
            </p>
        `;
    } else {
        container.innerHTML = cartEntries.map(
            ([id, quantity]) => {
                const product = products.find(
                    item => item.id === Number(id)
                );

                return `
                    <div class="cart-item">

                        <img
                            src="${escapeHTML(product.image)}"
                            alt="${escapeHTML(product.title)}"
                        >

                        <div class="cart-item-info">

                            <h4>
                                ${escapeHTML(product.title)}
                            </h4>

                            <p>
                                ${formatPrice(product.price * quantity)}
                            </p>

                            <div class="cart-quantity">

                                <button
                                    data-action="decrease"
                                    data-id="${id}"
                                >−</button>

                                <span>${quantity}</span>

                                <button
                                    data-action="increase"
                                    data-id="${id}"
                                >+</button>

                            </div>

                        </div>

                        <button
                            data-action="remove"
                            data-id="${id}"
                        >
                            Remove
                        </button>

                    </div>
                `;
            }
        ).join("");
    }

    $("#cartTotal").textContent =
        formatPrice(getCartTotal());
}

// ========================================
// RENDER WISHLIST
// ========================================

function renderWishlist() {
    const container = $("#wishlistItems");

    const favorites = wishlist
        .map(id => products.find(
            product => product.id === id
        ))
        .filter(Boolean);

    if (favorites.length === 0) {
        container.innerHTML = `
            <p class="empty-list">
                Your wishlist is empty.
                Add products you love!
            </p>
        `;

        return;
    }

    container.innerHTML = favorites.map(product => `
        <div class="wishlist-item">

            <img
                src="${escapeHTML(product.image)}"
                alt="${escapeHTML(product.title)}"
            >

            <div class="wishlist-item-info">

                <h4>${escapeHTML(product.title)}</h4>

                <p>${formatPrice(product.price)}</p>

            </div>

            <button
                data-action="wishlist-remove"
                data-id="${product.id}"
            >
                Remove
            </button>

            <button
                data-action="add"
                data-id="${product.id}"
            >
                + Add
            </button>

        </div>
    `).join("");
}

// ========================================
// MODALS
// ========================================

function openModal(id) {
    if (id === "cartModal") {
        renderCart();
    }

    if (id === "wishlistModal") {
        renderWishlist();
    }

    $("#" + id).hidden = false;

    document.body.style.overflow = "hidden";
}

function closeModal(id) {
    $("#" + id).hidden = true;

    if (!document.querySelector(".modal:not([hidden])")) {
        document.body.style.overflow = "";
    }
}

// ========================================
// PRODUCT BUTTON EVENTS
// ========================================

productGrid.addEventListener("click", event => {
    const button = event.target.closest(
        "button[data-action]"
    );

    if (!button) return;

    const id = Number(button.dataset.id);

    if (button.dataset.action === "add") {
        addToCart(id);
    }

    if (button.dataset.action === "wishlist") {
        toggleWishlist(id);
    }
});

// ========================================
// CART BUTTON EVENTS
// ========================================

$("#cartItems").addEventListener("click", event => {
    const button = event.target.closest(
        "button[data-action]"
    );

    if (!button) return;

    const id = Number(button.dataset.id);

    if (!cart[id]) return;

    if (button.dataset.action === "increase") {
        cart[id] += 1;
    }

    if (button.dataset.action === "decrease") {
        cart[id] -= 1;

        if (cart[id] <= 0) {
            delete cart[id];
        }
    }

    if (button.dataset.action === "remove") {
        delete cart[id];
    }

    saveStorage();
    updateAnalytics();
    renderCart();
});

// ========================================
// WISHLIST BUTTON EVENTS
// ========================================

$("#wishlistItems").addEventListener("click", event => {
    const button = event.target.closest(
        "button[data-action]"
    );

    if (!button) return;

    const id = Number(button.dataset.id);

    if (button.dataset.action === "wishlist-remove") {
        wishlist = wishlist.filter(
            item => item !== id
        );

        saveStorage();
        updateAnalytics();
        renderWishlist();
        renderProducts();
    }

    if (button.dataset.action === "add") {
        addToCart(id);
    }
});

// ========================================
// SEARCH, FILTER AND SORT
// ========================================

searchInput.addEventListener(
    "input",
    renderProducts
);

categoryFilter.addEventListener(
    "change",
    renderProducts
);

sortFilter.addEventListener(
    "change",
    renderProducts
);

$("#clearFilters").addEventListener("click", () => {
    searchInput.value = "";
    categoryFilter.value = "all";
    sortFilter.value = "default";

    renderProducts();
});

// ========================================
// RETRY BUTTON
// ========================================

$("#retryButton").addEventListener(
    "click",
    fetchProducts
);

// ========================================
// OPEN CART AND WISHLIST
// ========================================

$("#cartButton").addEventListener("click", () => {
    openModal("cartModal");
});

$("#wishlistButton").addEventListener("click", () => {
    openModal("wishlistModal");
});

// ========================================
// CLOSE MODALS
// ========================================

document.querySelectorAll("[data-close]").forEach(
    button => {
        button.addEventListener("click", () => {
            closeModal(button.dataset.close);
        });
    }
);

document.querySelectorAll(".modal").forEach(modal => {
    modal.addEventListener("click", event => {
        if (event.target === modal) {
            closeModal(modal.id);
        }
    });
});

document.addEventListener("keydown", event => {
    if (event.key === "Escape") {
        document.querySelectorAll(
            ".modal:not([hidden])"
        ).forEach(modal => {
            closeModal(modal.id);
        });
    }
});

// ========================================
// CLEAR CART
// ========================================

$("#clearCart").addEventListener("click", () => {
    cart = {};

    saveStorage();
    updateAnalytics();
    renderCart();

    showToast("Your cart has been cleared.");
});

// ========================================
// DARK MODE
// ========================================

function loadTheme() {
    let theme = "light";

    try {
        theme = localStorage.getItem(
            "shopsphere-theme"
        ) || "light";
    } catch (error) {
        console.warn("Could not load theme.");
    }

    document.body.classList.toggle(
        "dark",
        theme === "dark"
    );

    $("#themeToggle").textContent =
        theme === "dark" ? "☀️" : "🌙";
}

$("#themeToggle").addEventListener("click", () => {
    const isDark = document.body.classList.toggle("dark");

    $("#themeToggle").textContent =
        isDark ? "☀️" : "🌙";

    try {
        localStorage.setItem(
            "shopsphere-theme",
            isDark ? "dark" : "light"
        );
    } catch (error) {
        console.warn("Could not save theme.");
    }
});

// ========================================
// INITIALIZE APPLICATION
// ========================================

loadTheme();

updateAnalytics();

fetchProducts();