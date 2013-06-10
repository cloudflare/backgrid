/*
  backgrid
  http://github.com/wyuenho/backgrid

  Copyright (c) 2013 Jimmy Yuen Ho Wong and contributors
  Licensed under the MIT @license.
*/

/**
   HeaderCell is a special cell class that renders a column header cell. If the
   column is sortable, a sorter is also rendered and will trigger a table
   refresh after sorting.

   @class Backgrid.HeaderCell
   @extends Backbone.View
 */
var HeaderCell = Backgrid.HeaderCell = Backbone.View.extend({

  /** @property */
  tagName: "th",

  /** @property */
  events: {
    "click a": "onClick"
  },

  /**
    @property {null|"ascending"|"descending"} _direction The current sorting
    direction of this column.
  */
  _direction: null,

  /**
     Initializer.

     @param {Object} options
     @param {Backgrid.Column|Object} options.column
     @param {function(*, *): number} options.comparator
     @param {function(*, *): *} option.value

     @throws {TypeError} If options.column or options.collection is undefined.
   */
  initialize: function (options) {
    Backgrid.requireOptions(options, ["column", "collection"]);
    this.column = options.column;
    if (!(this.column instanceof Column)) {
      this.column = new Column(this.column);
    }

    this.comparator = this.column.get("comparator") || options.comparator || this.comparator;
    this.value = this.column.get("value") || options.value || this.value;

    this.listenTo(this.collection, "backgrid:sort", this._resetCellDirection);
  },

  /**
     Gets or sets the direction of this cell. If called directly without
     parameters, returns the current direction of this cell, otherwise sets
     it. If a `null` is given, sets this cell back to the default order.

     @param {null|"ascending"|"descending"} dir
     @return {null|string} The current direction or the changed direction.
   */
  direction: function (dir) {
    if (arguments.length) {
      if (this._direction) this.$el.removeClass(this._direction);
      if (dir) this.$el.addClass(dir);
      this._direction = dir;
    }

    return this._direction;
  },

  /**
     Event handler for the Backbone `backgrid:sort` event. Resets this cell's
     direction to default if sorting is being done on another column.

     @private
   */
  _resetCellDirection: function (sortByColName, direction, comparator, collection) {
    if (collection == this.collection) {
      if (sortByColName !== this.column.get("name")) this.direction(null);
      else this.direction(direction);
    }
  },

  /**
     Event handler for the `click` event on the cell's anchor. If the column is
     sortable, clicking on the anchor will cycle through 3 sorting orderings -
     `ascending`, `descending`, and default.
   */
  onClick: function (e) {
    e.preventDefault();

    var column = this.column;
    var columnName = column.get("name");
    var sortable = Backgrid.callByNeed(column.get("sortable"), column, this.model);
    if (sortable) {
      if (this.direction() === "ascending") {
        this.sort(columnName, "descending");
      }
      else if (this.direction() === "descending") {
        this.sort(columnName, null);
      }
      else {
        this.sort(columnName, "ascending");
      }
    }
  },

  makeComparator: function (attr, order) {
    if (!attr || !order) return;
    var invert = order === 1, comparator = this.comparator, value = this.value;
    if (invert) {
      return function(left, right) {
        return comparator(value(right, attr), value(left, attr));
      };
    } else {
      return function(left, right) {
        return comparator(value(left, attr), value(right, attr));
      };
    }
  },

  /**
     Overridable value extractor function that makes it possible to extract
     a custom value when sorting.

     @param {Backbone.Model} model
     @param {string} attr
  */
  value: function (model, attr) {
    return model.get(attr);
  },

  /**
     Overridable comparator function. By default, it does a simple value
     comparison using less than/greater than.
  */
  comparator: function (left, right) {
    if (left === right) {
      return 0;
    }
    else if (left < right) { return -1; }
    return 1;
  },

  /**
     If the underlying collection is a Backbone.PageableCollection in
     server-mode or infinite-mode, a page of models is fetched after sorting is
     done on the server.

     If the underlying collection is a Backbone.PageableCollection in
     client-mode, or any
     [Backbone.Collection](http://backbonejs.org/#Collection) instance, sorting
     is done on the client side. If the collection is an instance of a
     Backbone.PageableCollection, sorting will be done globally on all the pages
     and the current page will then be returned.

     Triggers a Backbone `backgrid:sort` event from the collection when done
     with the column name, direction, comparator and a reference to the
     collection.

     @param {string} columnName
     @param {null|"ascending"|"descending"} direction
     @param {function(*, *): number} [comparator]

     See [Backbone.Collection#comparator](http://backbonejs.org/#Collection-comparator)
  */
  sort: function (columnName, direction) {
    var order = direction == "ascending" ? -1 : direction == "descending" ? 1 : null;
    var comparator = this.makeComparator(columnName, order) || this._cidComparator;
    var collection = this.collection;

    if (Backbone.PageableCollection && collection instanceof Backbone.PageableCollection) {
      collection.setSorting(order ? columnName : null, order, {makeComparator: _.bind(this.makeComparator, this)});

      if (collection.mode == "client") {
        if (!collection.fullCollection.comparator) {
          collection.fullCollection.comparator = comparator;
        }
        collection.fullCollection.sort();
      }
      else collection.fetch({reset: true});
    }
    else {
      collection.comparator = comparator;
      collection.sort();
    }

    this.collection.trigger("backgrid:sort", columnName, direction, comparator, this.collection);
  },

  /**
     Default comparator for Backbone.Collections. Sorts cids in ascending
     order. The cids of the models are assumed to be in insertion order.

     @private
     @param {*} left
     @param {*} right
  */
  _cidComparator: function (left, right) {
    var lcid = left.cid, rcid = right.cid;
    if (!_.isUndefined(lcid) && !_.isUndefined(rcid)) {
      lcid = lcid.slice(1) * 1, rcid = rcid.slice(1) * 1;
      if (lcid < rcid) return -1;
      else if (lcid > rcid) return 1;
    }

    return 0;
  },

  /**
     Renders a header cell with a sorter and a label.
   */
  render: function () {
    this.$el.empty();
    var $label = $("<a>").text(this.column.get("label"));
    var sortable = Backgrid.callByNeed(this.column.get("sortable"), this.column, this.model);
    if (sortable) $label.append("<b class='sort-caret'></b>");
    this.$el.append($label);
    this.delegateEvents();
    return this;
  }

});

/**
   HeaderRow is a controller for a row of header cells.

   @class Backgrid.HeaderRow
   @extends Backgrid.Row
 */
var HeaderRow = Backgrid.HeaderRow = Backgrid.Row.extend({

  requiredOptions: ["columns", "collection"],

  /**
     Initializer.

     @param {Object} options
     @param {Backbone.Collection.<Backgrid.Column>|Array.<Backgrid.Column>|Array.<Object>} options.columns
     @param {Backgrid.HeaderCell} [options.headerCell] Customized default
     HeaderCell for all the columns. Supply a HeaderCell class or instance to a
     the `headerCell` key in a column definition for column-specific header
     rendering.

     @throws {TypeError} If options.columns or options.collection is undefined.
   */
  initialize: function () {
    Backgrid.Row.prototype.initialize.apply(this, arguments);
  },

  makeCell: function (column, options) {
    var headerCell = column.get("headerCell") || options.headerCell || HeaderCell;
    headerCell = new headerCell({
      column: column,
      collection: this.collection
    });
    return headerCell;
  }

});

/**
   Header is a special structural view class that renders a table head with a
   single row of header cells.

   @class Backgrid.Header
   @extends Backbone.View
 */
var Header = Backgrid.Header = Backbone.View.extend({

  /** @property */
  tagName: "thead",

  /**
     Initializer. Initializes this table head view to contain a single header
     row view.

     @param {Object} options
     @param {Backbone.Collection.<Backgrid.Column>|Array.<Backgrid.Column>|Array.<Object>} options.columns Column metadata.
     @param {Backbone.Model} options.model The model instance to render.

     @throws {TypeError} If options.columns or options.model is undefined.
   */
  initialize: function (options) {
    Backgrid.requireOptions(options, ["columns", "collection"]);

    this.columns = options.columns;
    if (!(this.columns instanceof Backbone.Collection)) {
      this.columns = new Columns(this.columns);
    }

    this.row = new Backgrid.HeaderRow({
      columns: this.columns,
      collection: this.collection
    });
  },

  /**
     Renders this table head with a single row of header cells.
   */
  render: function () {
    this.$el.append(this.row.render().$el);
    this.delegateEvents();
    return this;
  },

  /**
     Clean up this header and its row.

     @chainable
   */
  remove: function () {
    this.row.remove.apply(this.row, arguments);
    return Backbone.View.prototype.remove.apply(this, arguments);
  }

});
