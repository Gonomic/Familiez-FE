import '@testing-library/jest-dom';

// jsdom mist vaak SVG text metingen; provide a deterministic fallback for tests.
if (typeof SVGElement !== 'undefined' && !SVGElement.prototype.getComputedTextLength) {
	SVGElement.prototype.getComputedTextLength = function getComputedTextLength() {
		const text = this.textContent || '';
		return text.length * 7;
	};
}
