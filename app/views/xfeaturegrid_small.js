var Template = require('./templates/xfeaturegrid_small');
var StacksVis = require('../views/stacksvis_container');

module.exports = Backbone.View.extend({

    initialize:function (options) {
        _.extend(this, options);
        _.bindAll(this, "loadData");

        this.model.on("load", this.loadData);

        if (_.isEmpty(this.genes)) {
            this.genes = ["TP53", "CTCF"];
        }
    },

    loadData: function() {
        var geneA = this.genes[0];
        var geneB = this.genes[1];

        var negative_color_scale = d3.scale.linear().domain([-16.0, 0.0]).range(["blue", "white"]);
        var positive_color_scale = d3.scale.linear().domain([0.0, 16.0]).range(["white", "red"]);

        var data = this.model.get("data");
        var ROWS = [];
        var COLUMNS = [];
        var DATA = [];

        ROWS.push("cancer");
        _.each(data, function(data_item) {
            _.each(_.keys(data_item.get("pwpv")), function(k) {
                ROWS.push(k);
            });
        });
        _.each(data, function(data_item) {
            var cancer = data_item.get("cancer");
            var pwpv = data_item.get("pwpv");
            var row_values = _.values(pwpv);
            _.each(row_values, function(row_value) {
                var cancers = [];
                _.each(row_value, function() {
                    cancers.push(cancer);
                });
                DATA.push(cancers);
                DATA.push(_.map(row_value, function(rv, rvk) {

                    COLUMNS.push(rvk);
                    return rv["mlog10p"];
                }));
            });
        });

        var model = new Backbone.Model({
            "DATA": DATA,
            "ROWS": ROWS,
            "COLUMNS": COLUMNS
        });

        var vis = new StacksVis({
            model: model,
            clusterProperty: "cancer"
        });

//        this.$el.html(Template({}));

        this.$el.html(vis.render().el);
        model.trigger("load");
    }
});