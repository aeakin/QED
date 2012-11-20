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
        
        var rowdata = [];
        _.each(data, function(data_item) {
            var cancer = data_item.get("cancer");
            _.each(_.values(data_item.get("pwpv")), function(row_value) {
                var cancers = [];
                _.each(row_value, function() {
                    cancers.push(cancer);
                });
                rowdata.push(cancers);
            });
        });
        var CANCERS = _.compact(_.flatten(rowdata));
        DATA.push(_.compact(_.flatten(rowdata)));

        _.each(data, function(data_item) {
            rowdata = [];
            _.each(_.values(data_item.get("pwpv")), function(row_value) {
                var cancer = data_item.get("cancer");
                rowdata.push(_.map(row_value, function(rv, rvk) {
                    COLUMNS.push(rvk);
                    console.log(cancer + ":" + rvk + ":" + JSON.stringify(rv));
                    return rv["mlog10p"];
                }));
            });
            DATA.push(_.compact(_.flatten(rowdata)));
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