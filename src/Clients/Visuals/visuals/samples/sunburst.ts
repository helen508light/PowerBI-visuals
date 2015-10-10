﻿/// <reference path="../../_references.ts"/>

module powerbi.visuals.samples {
    import SelectionManager = utility.SelectionManager;
    export interface SunburstNode {
        children?: SunburstNode[];
        value?: any;
        color?: string;
        name?: string;
        parent?: SunburstNode;
        selector: SelectionId;
        total: number;
    }

    export interface SunburstViewModel {
        root: SunburstNode;
    }

    export var sunburstRoleNames = {
        nodes: 'Nodes',
        values: 'Values',
    };

    export class Sunburst implements IVisual {
        
        public static capabilities: VisualCapabilities = {
        };
        private static minOpacity = 0.2;
        private disableMouseOut: boolean = false;
        private svg: D3.Selection;
        private g: D3.Selection;
        private viewport: IViewport;
        private colors: IDataColorPalette;
        private selectionManager: SelectionManager;

        public init(options: VisualInitOptions): void {

            this.arc = d3.svg.arc()
                .startAngle(function (d) { return d.x; })
                .endAngle(function (d) { return d.x + d.dx; })
                .innerRadius(function (d) { return Math.sqrt(d.y); })
                .outerRadius(function (d) { return Math.sqrt(d.y + d.dy); });

            this.colors = options.style.colorPalette.dataColors;
            this.selectionManager = new SelectionManager({ hostServices: options.host });
            this.svg = d3.select(options.element.get(0)).append('svg');
            this.svg.attr('class', 'mainDrawArea');
            this.g = this.svg.append('g');
            this.g.attr('class', "container");
            this.g
                .on("mouseleave", (d) => { this.mouseleave(d, this); });
            this.svg.append("text")
                .attr('class', "sunBurstPercentage");
            this.svg.append("text")
                .attr('class', "sunBurstPercentageFixed");

            this.svg.on('mousedown', (d) => {
                this.svg.selectAll("path").style("opacity", 1);
                this.disableMouseOut = false;
                this.svg.select(".sunBurstPercentageFixed").style("opacity", 0);
                this.selectionManager.clear();
            });
            let svg_obj = this.svg;
            svg_obj.on("mousemove", function () {
                let point = d3.mouse(this)
                    , p = { x: point[0], y: point[1] };
                let shift = 20;
                let percentageText = svg_obj.select(".sunBurstPercentage");
                percentageText.attr("y", p.y + shift);
                percentageText.attr("x", p.x + shift);
            });

        }

        private static setAllUnhide(selection): void {
            selection.attr("setUnHide", "true");
        }
      
        public update(options: VisualUpdateOptions): void {
            if (options.dataViews.length > 0) {
                let data = this.converter(options.dataViews[0], this.colors);
                this.viewport = options.viewport;
                this.updateInternal(data);
            }
        }

        private updateInternal(dataRootNode: SunburstNode): void {

            this.svg.attr({
                'height': this.viewport.height,
                'width': this.viewport.width
            });
            this.g.attr("transform", "translate(" + this.viewport.width / 2 + "," + this.viewport.height / 2 + ")");
            let radius = Math.min(this.viewport.width, this.viewport.height) / 2;

            let partition = d3.layout.partition()
                .size([2 * Math.PI, radius * radius])
                .value((d) => { return d.value; });

            let path = this.g.datum(dataRootNode).selectAll("path")
                .data(partition.nodes);
            path.enter().append("path");
            path.attr("display", (d) => { return d.depth ? null : "none"; })
                .attr("d", this.arc)
                .style("stroke", "#fff")
                .style("fill", (d) => { return d.color; })
                .style("fill-rule", "evenodd")
                .on("mouseover", (d) => { this.mouseover(d, this, false); })
                .on("mouseleave", (d) => { this.mouseleave(d, this); })
                .on("mousedown", (d) => {

                    this.selectionManager.select(d.selector);
                    d3.selectAll("path").call(Sunburst.setAllUnhide).attr('setUnHide', null);
                    this.svg.select(".container").on("mouseleave", null);
                    this.mouseover(d, this, true);
                    this.disableMouseOut = true;

                    let percentageFixedText = this.svg.select(".sunBurstPercentageFixed");
                    var percentage = (100 * d.total / this.total).toPrecision(3);
                    percentageFixedText.text(d ? percentage + "%" : "");
                    percentageFixedText.style('fill', d.color);
                    this.onResize();
                    event.stopPropagation();
                });
            
            this.onResize();
        }

        private arc: D3.Svg.Arc;
        // Stash the old values for transition.
        private total: number = 0;
        // Get all parents of the node
        private static getTreePath(node) {
            let path = [];
            let current = node;
            while (current.parent) {
                path.unshift(current);
                current = current.parent;
            }
            return path;
        }

        private onResize(): void {
            let width = this.viewport.width;
            let height = this.viewport.height;
            let percentageText = this.svg.select(".sunBurstPercentage");
            let percentageFixedText = this.svg.select(".sunBurstPercentageFixed");
            percentageText.style("opacity", 1);
            percentageFixedText.style("opacity", 1);
            percentageFixedText.attr("y", (height / 2));
            percentageFixedText.attr("x", ((width / 2) - (percentageFixedText.node().clientWidth / 2)));
        }

        private mouseover(d, sunBurst, setUnhide): void {
            if (d) {
                let percentageText = sunBurst.svg.select(".sunBurstPercentage");
                var percentage = (100 * d.total / this.total).toPrecision(3);
                percentageText.text(percentage + "%");
                sunBurst.onResize();
            }
            
            let parentsArray = d ? Sunburst.getTreePath(d) : [];
            // Set opacity for all the segments.
            sunBurst.svg.selectAll("path").each(function () {
                if (d3.select(this).attr('setUnHide') !== 'true') {
                    d3.select(this).style("opacity", Sunburst.minOpacity);
                }
            });
            // Highlight only ancestors of the current segment.
            sunBurst.svg.selectAll("path")
                .filter(function (node) {
                    return (parentsArray.indexOf(node) >= 0);
                }).each(function () {
                    d3.select(this).style("opacity", 1);
                    if (setUnhide === true) {
                        d3.select(this).attr('setUnHide', 'true');
                    }
                });
        }

        private mouseleave(d, sunBurst): void {

            if (!sunBurst.disableMouseOut) {
                sunBurst.svg.selectAll("path")
                    .style("opacity", 1);
                let percentageText = this.svg.select(".sunBurstPercentage");
                percentageText.style("opacity", 0);
            }
            else {
                sunBurst.mouseover(null, sunBurst);
            }
        }

        private covertTreeNodeToSunBurstNode(originParentNode: DataViewTreeNode, sunburstParentNode: SunburstNode, colors: IDataColorPalette): SunburstNode {
            let key = (originParentNode.children ? originParentNode : sunburstParentNode).name;
            let newSunNode: SunburstNode = {
                name: originParentNode.name,
                value: originParentNode.value,
                selector: SelectionId.createWithId(originParentNode.identity),
                color: colors.getColorScaleByKey(':)').getColor(key).value,
                total: originParentNode.value ? originParentNode.value:0
            };
            this.total += (newSunNode.value ? newSunNode.value:0);
            if (originParentNode.children && originParentNode.children.length > 0) {
                newSunNode.children = [];
                for (let i = 0; i < originParentNode.children.length; i++) {
                    var newChild = this.covertTreeNodeToSunBurstNode(originParentNode.children[i], newSunNode, colors);
                    newSunNode.children.push(
                        newChild
                        );
                    newSunNode.total += newChild.total;
                }
            }
            if (sunburstParentNode) {
                newSunNode.parent = sunburstParentNode;
            }

            return newSunNode;
        }

        public converter(dataView: DataView, colors: IDataColorPalette): SunburstNode{
            this.total = 0;
            let root: SunburstNode = this.covertTreeNodeToSunBurstNode(dataView.tree.root, null, colors);

            return root;
        }

    }
}