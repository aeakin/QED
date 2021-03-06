var View = require('./view');
var template = require('./templates/oncovis');
var ControlsView = require("../views/oncovis_controls");
var SelectorsView = require("../views/oncovis_selectors");
var GeneListView = require("../views/genelist_view");
var ALL_COLUMNS = "All Columns";

module.exports = View.extend({
    template:template,
    className:"row-fluid",
    clusterProperty: null,
    rowLabels:[],

    initialize:function (options) {
        _.extend(this, options);
        _.bindAll(this, 'renderGraph', 'initControls', 'onNewRows');

        this.storageKeys = {
            cluster: "oncovis_view." + this.model.get("dataset_id") + ".cluster_property",
            rows: "oncovis_view." + this.model.get("dataset_id") + ".row_labels"
        };

        this.clusterProperty = localStorage.getItem(this.storageKeys.cluster);

        var localRows = localStorage.getItem(this.storageKeys.rows);
        if (localRows && localRows.length) this.rowLabels = localRows.split(",");

        this.model.on("load", this.renderGraph);
    },

    afterRender:function () {
        this.initSelectors();

        new GeneListView({ $el: this.$el }).on("genelist-selected", this.onNewRows);
    },

    initSelectors: function() {
        var cluster = this.clusterProperty;
        if (cluster && cluster == ALL_COLUMNS) cluster = null;
        this.$el.find('.selected-cluster').html(cluster);

        var selectorView = new SelectorsView({
            model: this.model,
            cluster: cluster,
            rows: this.rowLabels
        });
        this.$el.find('.selector-modal').html(selectorView.render().el);

        var _this = this;
        selectorView.on("selected", function(data) {
            _this.clusterProperty = data.cluster || ALL_COLUMNS;
            _this.rowLabels = data.rows;

            localStorage.setItem(_this.storageKeys.cluster, _this.clusterProperty);
            localStorage.setItem(_this.storageKeys.rows, _this.rowLabels.join(","));

            _this.$el.find('.selected-cluster').html(data.cluster);
            _this.$el.find('.selector-modal').modal("hide");
            _this.model.trigger("load");
        });
    },

    getColumnModel:function () {
        var _this = this;
        var unsorted_columns = [];
        var cluster_property = this.clusterProperty || ALL_COLUMNS;
        if (cluster_property == ALL_COLUMNS) {
            _.each(this.model.get("COLUMNS"), function (column_name, col_idx) {
                var column = { "name":column_name.trim(), "cluster":ALL_COLUMNS, "values":[] };
                _.each(_this.rowLabels, function (row_label) {
                    var row_idx = _this.model.get("ROWS").indexOf(row_label);
                    column.values.push(_this.model.get("DATA")[row_idx][col_idx].trim().toLowerCase());
                });
                unsorted_columns.push(column);
            });
        } else {
            _.each(this.model.get("COLUMNS"), function (column_name, col_idx) {
                var cluster_idx = _this.model.get("ROWS").indexOf(cluster_property);
                var cluster_value = _this.model.get("DATA")[cluster_idx][col_idx].trim();
                var column = { "name":column_name.trim(), "cluster":cluster_value, "values":[cluster_value] };
                _.each(_this.rowLabels, function (row_label) {
                    var row_idx = _this.model.get("ROWS").indexOf(row_label);
                    column.values.push(_this.model.get("DATA")[row_idx][col_idx].trim().toLowerCase());
                });
                unsorted_columns.push(column);
            });
        }

        var sorted_columns = _.sortBy(unsorted_columns, "values");
        var grouped_columns = _.groupBy(sorted_columns, "cluster");

        var columns_by_cluster = {};
        _.each(grouped_columns, function (values, key) {
            columns_by_cluster[key] = [];
            _.each(values, function (value) {
                columns_by_cluster[key].push(value.name);
            })
        });
        return columns_by_cluster;
    },

    renderGraph:function () {
        this.initControls();

        if (_.isEmpty(this.rowLabels)) {
            var rows = this.model.get("ROWS");
            this.rowLabels = _.first(rows, (rows.length < 50) ? rows.length : 50);
        }

        if (this.clusterProperty) {
            var removeIdx = _.indexOf(this.rowLabels, this.clusterProperty);
            if (removeIdx >= 0) this.rowLabels.splice(removeIdx,1);
        }

        if (!this.rowLabels || !this.rowLabels.length) {
            this.$el.find('.selector-modal').modal("show");
            return;
        }

        var columns_by_cluster = this.getColumnModel();
        var data = {};
        var _this = this;
        _.each(this.rowLabels, function (rowLabel) {
            var row_idx = _this.model.get("ROWS").indexOf(rowLabel);
            var categories = _.uniq(_this.model.get("DATA")[row_idx]);
            var numberOfCategories = (categories.length < 3) ? 3 : categories.length;

            var colorscales = function (cell) {
                return colorbrewer.YlOrBr[numberOfCategories][categories.indexOf(cell)];
            };
            if (numberOfCategories > 7) {
                var colorscaleFn = d3.scale.ordinal().domain(categories)
                    .range(d3.range(categories.length)
                    .map(d3.scale.linear().domain([0, categories.length - 1])
                    .range(["yellow", "green"])
                    .interpolate(d3.interpolateLab)));
                colorscales = function (cell) {
                    return colorscaleFn(categories.indexOf(cell));
                }
            }

            _.each(_this.model.get("DATA")[row_idx], function (cell, cellIdx) {
                cell = cell.trim();
                var columnLabel = _this.model.get("COLUMNS")[cellIdx].trim();
                if (!data[columnLabel]) data[columnLabel] = {};
                data[columnLabel][rowLabel] = { "value":cell, "row":rowLabel, "colorscale":colorscales(cell), "label":columnLabel + "\n" + rowLabel + "\n" + cell };
            });
        });

        var optns = {
            plot_width:1500,
            plot_height:700,
            highlight_fill:colorbrewer.RdYlGn[3][2],
            color_fn:function (d) {
                return d ? d.colorscale : "white";
            },
            columns_by_cluster:columns_by_cluster,
            cluster_labels:_.keys(columns_by_cluster),
            row_labels:this.rowLabels
        };

        this.$el.find(".oncovis-container").oncovis(data, _.extend(optns, this.controls.initialValue()));
    },

    initControls:function () {
        this.controls = new ControlsView();
        this.$el.find('.controls-modal').html(this.controls.render().el);

        var oncovis_container = this.$el.find(".oncovis-container");
        this.controls.on("updated", function(dim) {
            oncovis_container.oncovis("update", dim);
        });
    },

    onNewRows:function (genelist) {
        if (genelist && genelist.values) {
            var _this = this;
            _.defer(function () {
                _this.rowLabels = _.filter(_this.model.get("ROWS"), function (row) {
                    return _.any(genelist.values, function (gene) {
                        return (row.toLowerCase().indexOf(gene.toLowerCase()) >= 0);
                    });
                });
                _this.model.trigger('load');
            });
        }
    }
});
