class JsonContext {
    constructor() {
        this.contextStack = [];
    }

    get current() {
        return this.contextStack[this.contextStack.length - 1];
    }

    get context() {
        return [...this.contextStack];
    }

    get empty() {
        return this.contextStack.length === 0;
    }

    set(value) {
        this.contextStack.push(value);
    }

    reset() {
        this.contextStack = [];
    }

    remove(value) {
        const index = this.contextStack.lastIndexOf(value);
        if (index !== -1) {
            this.contextStack.splice(index, 1);
        }
    }
}

// Context değerleri için enum benzeri sabitler
const ContextValues = {
    OBJECT_KEY: 'OBJECT_KEY',
    OBJECT_VALUE: 'OBJECT_VALUE',
    ARRAY: 'ARRAY'
};

module.exports = { JsonContext, ContextValues };
