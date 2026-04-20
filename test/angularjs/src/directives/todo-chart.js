/*global angular, d3 */

/**
 * Directive that renders a D3 bar chart showing todo statistics
 * (active vs completed counts). Demonstrates that D3 is available
 * as a global via the script-loader plugin.
 */
angular.module('todomvc').directive('todoChart', () => ({
    restrict: 'E',
    scope: {
        todos: '=',
    },
    link: (scope, element) => {
        var width = 180;
        var height = 200;
        var margin = { top: 15, right: 10, bottom: 25, left: 30 };
        var innerWidth = width - margin.left - margin.right;
        var innerHeight = height - margin.top - margin.bottom;

        var svg = d3
            .select(element[0])
            .append('svg')
            .attr('width', width)
            .attr('height', height)
            .style('display', 'block')
            .style('margin', '0 auto');

        var g = svg.append('g').attr('transform', 'translate(' + margin.left + ',' + margin.top + ')');

        var x = d3.scaleBand().domain(['Active', 'Done']).range([0, innerWidth]).padding(0.35);

        var y = d3.scaleLinear().range([innerHeight, 0]);

        var xAxisG = g
            .append('g')
            .attr('class', 'x-axis')
            .attr('transform', 'translate(0,' + innerHeight + ')');

        var yAxisG = g.append('g').attr('class', 'y-axis');

        // Style axis text
        svg.selectAll('text').style('font-size', '11px').style('fill', '#4d4d4d');

        scope.$watch(
            'todos',
            todos => {
                if (!todos) return;

                var active = todos.filter(t => !t.completed).length;
                var completed = todos.filter(t => t.completed).length;
                var data = [
                    { label: 'Active', count: active, color: '#b83f45' },
                    { label: 'Done', count: completed, color: '#4d9955' },
                ];

                y.domain([0, Math.max(todos.length, 1)]);

                xAxisG.call(d3.axisBottom(x));
                yAxisG.call(d3.axisLeft(y).ticks(Math.min(todos.length, 5)));

                // Style axis after rendering
                svg.selectAll('.x-axis text, .y-axis text').style('font-size', '11px').style('fill', '#4d4d4d');
                svg.selectAll('.domain, .tick line').style('stroke', '#ccc');

                var bars = g.selectAll('.bar').data(data, d => d.label);

                bars.enter()
                    .append('rect')
                    .attr('class', 'bar')
                    .attr('x', d => x(d.label))
                    .attr('width', x.bandwidth())
                    .attr('y', innerHeight)
                    .attr('height', 0)
                    .attr('rx', 3)
                    .merge(bars)
                    .transition()
                    .duration(300)
                    .attr('x', d => x(d.label))
                    .attr('y', d => y(d.count))
                    .attr('width', x.bandwidth())
                    .attr('height', d => innerHeight - y(d.count))
                    .attr('fill', d => d.color);

                bars.exit().remove();
            },
            true
        );
    },
}));
