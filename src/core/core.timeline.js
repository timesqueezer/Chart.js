"use strict";

module.exports = function(Chart) {

	var helpers = Chart.helpers;

	Chart.defaults.global.timeline = {
		display: true,
		position: 'top',
		fullWidth: true, // marks that this box should take the full width of the canvas (pushing down other boxes)

		fontStyle: 'bold',
		padding: 5,

        handleWidth: 8,
        handleColor: 'rgba(0, 0, 0, 0.5)'
	};

	Chart.Timeline = Chart.Element.extend({

		initialize: function(config) {
			helpers.extend(this, config);
			this.options = helpers.configMerge(Chart.defaults.global.timeline, config.options);

			// Contains left and right handle
			this.handles = {};
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
            helpers.extend(this.handles, {
                left: {
                    x: this.innerBox.x + (this.lLimit * this.innerBox.w), // Calculate from lLimit when updating
                    y: this.innerBox.y,
                    w: this.options.handleWidth,
                    h: this.innerBox.h,
                    clicked: false
                },
                right: {
                    x: (this.innerBox.w * this.rLimit) - this.options.handleWidth,
                    y: this.innerBox.y,
                    w: this.options.handleWidth,
                    h: this.innerBox.h,
                    clicked: false
                }
            });
            // Handle resizing here
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

                ctx.lineWidth = 2;
                ctx.strokeStyle = handleColor;
                ctx.fillStyle = '#7af';

                var h = this.handles;

                // Left
                ctx.strokeRect(h.left.x, h.left.y, h.left.w, h.left.h);
                ctx.fillRect(h.left.x, h.left.y, h.left.w, h.left.h);
                // Right
                ctx.strokeRect(h.right.x, h.right.y, h.right.w, h.right.h);
                ctx.fillRect(h.right.x, h.right.y, h.right.w, h.right.h);

			}
		},

        restoreData: function() {
            console.log('SHADOWDATA: ', this.shadowData);
            var lLabelIndex = Math.floor(this.shadowLabels.length * this.lLimit);
            var rLabelIndex = Math.ceil(this.shadowLabels.length * this.rLimit);

            this.chart.data.labels = this.shadowLabels.slice().splice(lLabelIndex, rLabelIndex-lLabelIndex);

            helpers.each(this.chart.data.datasets, function(dataset, datasetIndex) {
                var lIndex = Math.floor(this.shadowData[datasetIndex].length * this.lLimit);
                var rIndex = Math.ceil(this.shadowData[datasetIndex].length * this.rLimit);

                this.chart.data.datasets[datasetIndex].data = this.shadowData[datasetIndex].slice().splice(lIndex, rIndex-lIndex);
            }, this);
            console.log('ACTUAL DATASETS: ', this.chart.data.datasets);

            this.chart.update();
        },

        handleEvent: function(e) {
            var position = helpers.getRelativePosition(e, this.chart.chart);
            var h = this.handles;

            // Unset clicked in any case
            if (e.type === 'mouseout' || e.type === 'mouseup') {
                h.left.clicked = false;
                h.right.clicked = false;
                this.restoreData();
            } else {
                // Check if position lies inside one of the handles, set hover and/or clicked resp.
                if (position.x >= h.left.x && position.x <= (h.left.x + h.left.w) &&
                    position.y >= h.left.y && position.y <= (h.left.y + h.left.h) ) {

                    // Hover
                    if (e.type === 'mousemove') {
                        this.ctx.canvas.style.cursor = 'pointer';
                    // Mousedown -> clicked
                    } else if (!h.left.clicked && e.type == 'mousedown') {
                        console.log('LEFT HANDLE MOUSEDOWN');
                        h.left.clicked = true;
                    }
                } else if (position.x >= h.right.x && position.x <= (h.right.x + h.right.w) &&
                           position.y >= h.right.y && position.y <= (h.right.y + h.right.h) ) {

                    // Hover
                    if (e.type === 'mousemove') {
                        this.ctx.canvas.style.cursor = 'pointer';
                    // Mousedown -> clicked
                    } else if (!h.right.clicked && e.type == 'mousedown') {
                        console.log('RIGHT HANDLE MOUSEDOWN');
                        h.right.clicked = true;
                    }
                } else {
                    // Unset cursor on hover
                    if (e.type === 'mousemove') {
                        this.ctx.canvas.style.cursor = 'default';
                    }
                }

                // Update position if inside inner box and left of right handle
                if (h.left.clicked) {
                    var new_position = h.left.x + e.movementX;
                    if (new_position >= this.innerBox.x && new_position < (h.right.x - h.left.w)) {
                        //console.log('LEFT HANDLE MOUSEMOVE');
                        h.left.x = new_position;
                        this.lLimit = (h.left.x - this.innerBox.x) / this.innerBox.w;
                        this.draw();
                        //this.chart.update();
                    }
                } else if (h.right.clicked) {
                    var new_position = h.right.x + e.movementX;
                    if (new_position <= (this.innerBox.x + this.innerBox.w - h.right.w) && new_position > (h.left.x + h.left.w)) {
                        h.right.x = new_position;
                        this.rLimit = (h.right.x + this.options.handleWidth) / this.innerBox.w;
                        //console.log('RIGHT HANDLE MOUSEMOVE', this.rLimit);
                        this.draw();
                        //this.chart.update();
                    }
                }
            }
        }
	});
};