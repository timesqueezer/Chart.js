"use strict";

module.exports = function(Chart) {

	var helpers = Chart.helpers;

	Chart.defaults.global.timeline = {
		display: false,
		position: 'top',
		fullWidth: true, // marks that this box should take the full width of the canvas (pushing down other boxes)

		fontStyle: 'bold',
		padding: 5,

        handleWidth: 8,
        handleColor: 'rgba(0, 0, 0, 0.5)',
        handleBackgroundColor: 'rgba(0, 0, 0, 0.1)'
	};

	Chart.Timeline = Chart.Element.extend({

		initialize: function(config) {
			helpers.extend(this, config);
			this.options = helpers.configMerge(Chart.defaults.global.timeline, config.options);

			// Contains left and right handle
			this.handles = {
                left: {
                    clicked: false
                },
                right: {
                    clicked: false
                }
            };
            this.lLimit = 0;
            this.rLimit = 1;

            // Copy labels and data into shadow lists
            this.shadowLabels = this.chart.data.labels.slice();
            this.shadowData = [];
            helpers.each(this.chart.data.datasets, function(dataset, datasetIndex) {
                this.shadowData[datasetIndex] = dataset.data.slice();
            }, this);

		},

		// These methods are ordered by lifecyle. Utilities then follow.

		beforeUpdate: helpers.noop,
		update: function(maxWidth, maxHeight, margins) {

			// Update Lifecycle - Probably don't want to ever extend or overwrite this function ;)
			this.beforeUpdate();

			// Absorb the master measurements
			this.maxWidth = maxWidth;
			this.maxHeight = maxHeight;
			this.margins = margins;

			// Dimensions
			this.beforeSetDimensions();
			this.setDimensions();
			this.afterSetDimensions();
			// Fit
			this.beforeFit();
			this.fit();
			this.afterFit();

            // Handles
            this.beforeBuildHandles();
            this.buildHandles();
            this.afterBuildHandles();

			//
			this.afterUpdate();

			return this.minSize;

		},
		afterUpdate: helpers.noop,

		//

		beforeSetDimensions: helpers.noop,
		setDimensions: function() {
			// Set the unconstrained dimension before label rotation
			if (this.isHorizontal()) {
				// Reset position before calculating rotation
				this.width = this.maxWidth;
				this.left = 0;
				this.right = this.width;
			} else {
				this.height = this.maxHeight;

				// Reset position before calculating rotation
				this.top = 0;
				this.bottom = this.height;
			}

			// Reset padding
			this.paddingLeft = 0;
			this.paddingTop = 0;
			this.paddingRight = 0;
			this.paddingBottom = 20;

			// Reset minSize
			this.minSize = {
				width: 0,
				height: 0
			};
		},
		afterSetDimensions: helpers.noop,

        //

        beforeFit: helpers.noop,
        fit: function() {

            var ctx = this.ctx;
            var fontSize = helpers.getValueOrDefault(this.options.fontSize, Chart.defaults.global.defaultFontSize);
            var fontStyle = helpers.getValueOrDefault(this.options.fontStyle, Chart.defaults.global.defaultFontStyle);
            var fontFamily = helpers.getValueOrDefault(this.options.fontFamily, Chart.defaults.global.defaultFontFamily);
            var titleFont = helpers.fontString(fontSize, fontStyle, fontFamily);

            // Width
            if (this.isHorizontal()) {
                this.minSize.width = this.maxWidth; // fill all the width
                this.minSize.height = this.maxHeight / 6; // fill all the height
            }
            // Increase sizes here
            /*if (this.isHorizontal()) {

                // Title
                if (this.options.display) {
                    this.minSize.height += fontSize + 50 + (this.options.padding * 2);
                }
            } else {
                if (this.options.display) {
                    this.minSize.width += fontSize + (this.options.padding * 2);
                }
            }*/

            this.width = this.minSize.width;
            this.height = this.minSize.height;

        },
        afterFit: helpers.noop,

		//

		beforeBuildHandles: helpers.noop,
		buildHandles: function() {
            this.innerBox = {
                x: this.left + this.options.padding,
                y: this.top + this.options.padding,
                w: this.width - (this.options.padding * 2),
                h: this.height - (this.options.padding * 2)
            };

            // Update positions
            this.handles.left.x = this.innerBox.x + (this.lLimit * this.innerBox.w); // Calculate from lLimit when updating
            this.handles.left.y = this.innerBox.y;
            this.handles.left.w = this.options.handleWidth;
            this.handles.left.h = this.innerBox.h;

            this.handles.right.x = (this.innerBox.w * this.rLimit) - this.options.handleWidth;
            this.handles.right.y = this.innerBox.y;
            this.handles.right.w = this.options.handleWidth;
            this.handles.right.h = this.innerBox.h;

        },
		afterBuildHandles: helpers.noop,

		// Shared Methods
		isHorizontal: function() {
			return this.options.position === "top" || this.options.position === "bottom";
		},

        clear: function() {
            this.ctx.clearRect(this.left, this.top, this.width, this.height);
        },

		// Actualy draw the title block on the canvas
		draw: function() {
			if (this.options.display) {
				var ctx = this.ctx;
                this.clear();

                var handleColor = helpers.getValueOrDefault(this.options.handleColor, Chart.defaults.global.defaultFontColor);
                var handleBackgroundColor = helpers.getValueOrDefault(this.options.handleBackgroundColor, Chart.defaults.global.defaultColor);

                ctx.lineWidth = 1;
                ctx.strokeStyle = handleColor;
                ctx.fillStyle = handleBackgroundColor;

                var h = this.handles;

                // Left
                ctx.strokeRect(h.left.x, h.left.y, h.left.w, h.left.h);
                ctx.fillRect(h.left.x, h.left.y, h.left.w, h.left.h);
                // Right
                ctx.strokeRect(h.right.x, h.right.y, h.right.w, h.right.h);
                ctx.fillRect(h.right.x, h.right.y, h.right.w, h.right.h);

			}
		},

        updateData: function() {
            var lIndex = Math.floor(this.shadowLabels.length * this.lLimit);
            var rIndex = Math.ceil(this.shadowLabels.length * this.rLimit);

            this.chart.data.labels = this.shadowLabels.slice().splice(lIndex, rIndex-lIndex);

            helpers.each(this.chart.data.datasets, function(dataset, datasetIndex) {
                this.chart.data.datasets[datasetIndex].data = this.shadowData[datasetIndex].slice().splice(lIndex, rIndex-lIndex);
            }, this);

            console.log(this.shadowData[0].length);

            this.chart.update(500);
        },

        handleEvent: function(e) {
            var position = helpers.getRelativePosition(e, this.chart.chart);
            var h = this.handles;

            // Unset clicked in any case
            if (e.type === 'mouseout' || e.type === 'mouseup') {
                h.left.clicked = false;
                h.right.clicked = false;
            } else {
                // Check if position lies inside one of the handles, set hover and/or clicked resp.
                if (position.x >= h.left.x && position.x <= (h.left.x + h.left.w) &&
                    position.y >= h.left.y && position.y <= (h.left.y + h.left.h) ) {

                    // Hover
                    if (e.type === 'mousemove') {
                        this.ctx.canvas.style.cursor = 'ew-resize';
                    // Mousedown -> clicked
                    } else if (!h.left.clicked && e.type == 'mousedown') {
                        h.left.clicked = true;
                    }

                // If inside right handle
                } else if (position.x >= h.right.x && position.x <= (h.right.x + h.right.w) &&
                           position.y >= h.right.y && position.y <= (h.right.y + h.right.h) ) {

                    // Hover
                    if (e.type === 'mousemove') {
                        this.ctx.canvas.style.cursor = 'ew-resize';
                    // Mousedown -> clicked
                    } else if (!h.right.clicked && e.type == 'mousedown') {
                        h.right.clicked = true;
                    }

                // Outside
                } else {
                    // Unset cursor on hover
                    if (e.type === 'mousemove') {
                        this.ctx.canvas.style.cursor = 'default';
                    }
                }

                // Update position if inside inner box and left of right handle
                if (h.left.clicked) {
                    var newLeftPosition = h.left.x + e.movementX;
                    if (newLeftPosition >= this.innerBox.x && newLeftPosition < (h.right.x - h.left.w)) {
                        h.left.x = newLeftPosition;
                        this.lLimit = (h.left.x - this.innerBox.x) / this.innerBox.w;
                        this.updateData();
                    }
                } else if (h.right.clicked) {
                    var newRightPosition = h.right.x + e.movementX;
                    if (newRightPosition <= (this.innerBox.x + this.innerBox.w - h.right.w) && newRightPosition > (h.left.x + h.left.w)) {
                        h.right.x = newRightPosition;
                        this.rLimit = (h.right.x + this.options.handleWidth) / this.innerBox.w;
                        this.updateData();
                    }
                }
            }
        }
	});
};