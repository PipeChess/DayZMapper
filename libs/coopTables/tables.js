const getChildrenTextContent = function (children) {
    return children.map(function (node) {
        return node.children
            ? getChildrenTextContent(node.children)
            : node.text
    }).join('')
};

const default_formatters = {
    //this is also the default for unknown/undefined types
    default: {
        value: noop,
        sort: default_sort,
        numeric: false
    },
    string: {
        format: trim_string,
        value: noop,
        sort: default_sort,
        numeric: false
    },
    number: {
        format: format_number,
        value: digits_period_only,
        sort: numeric_sort,
        numeric: true
    },
    dollar: {
        format: format_dollar_value,
        value: digits_period_only,
        sort: numeric_sort,
        numeric: true
    },
    date: {
        format: format_date,
        value: date_as_timestamp,
        sort: numeric_sort,
        numeric: true,
        total: false
    },
    datetime: {
        format: format_datetime,
        value: date_as_timestamp,
        sort: numeric_sort,
        numeric: true,
        total: false
    },
    time: {
        format: format_time,
        value: date_as_timestamp,
        sort: numeric_sort,
        numeric: true,
        total: false
    },
    timestamp: {
        format: format_datetime,
        value: digits_period_only,
        sort: numeric_sort,
        numeric: true,
        total: false
    }
}

const table_formatters = {
    formatters: default_formatters,
    modify: function (append) {
        this.$table_formatters = {...this.$table_formatters, ...append}
    },

    //for global registration with Vue.use()
    install: function (Vue, options) {
        Vue.prototype.$table_formatters = {...table_formatters.formatters, ...options};
        Vue.prototype.$modify_formatters = table_formatters.modify;
    }
};

//These props are common to at least two of t_header, header and footer components
const common_props = {
    // debug: {
    //     type: Boolean,
    //     default: false
    // },
    avg: {
        type: Boolean,
        default: false
    },
    filterable: {
        type: Boolean,
        default: false
    },
    index: {
        //column index
        type: Number
    },
    median: {
        type: Boolean,
        default: false
    },
    name: {
        //Column name
        type: String,
        default: ''
    },
    rendered: {
        //whether the parent component draws something instead of the header content
        type: Boolean,
        default: false
    },
    numeric: {
        //controls whether the column sorts numerically or lexically
        type: Boolean,
        default: false
    },
    sortable: {
        type: Boolean,
        default: false
    },

    type: {
        //arbitrary column data type name
        //used for rendering, filtering, sorting
        // 'date, 'datetime'. 'string', 'number' ,etc
        type: String,
        default: 'default'
    },
    total: {
        //controls whether to show column total in footer
        type: Boolean,
        default: false
    },
    width: {
        //overrides initial column width
        default: undefined
    }
};

Vue.component('table_footer', {
    inject: ['formatters', 'log'],
    props: common_props,
    data() {
        var supress_totals = (this.formatters[this.type] && (this.formatters[this.type].total == false));
        return {
            sum: 0,
            mean: 0,
            medi: 0,
            supress_totals: supress_totals
        };
    },
    template: '#t_footer',
    computed: {
        results: function () {
            this.log('footer compute results');
            if (!this.numeric || (this.$parent.transformedRows.length <= 1)) {
                return;
            } else {
                var idx = this.index;
                var rows = this.$parent.transformedRows;
                var data = [];
                var NanCount = 0;
                this.mean = this.medi = 0;
                this.sum = NaN; //sentinel value

                for (var count = 0; count < rows.length; count++) {
                    if (rows[count][this.index]) {
                        var val = rows[count][this.index].data;

                        if (!isNaN(val)) {
                            (isNaN(this.sum)) ? this.sum = 0 : this.sum;
                            this.sum += val;
                            data[count] = val;
                        }
                        else {
                            NanCount++;
                        }
                    }
                }
                this.mean = this.sum / (rows.length - NanCount);
                try {
                    data.sort((a, b) => this.formatters[this.type].sort(a, b));
                }
                catch {
                    if (this.numeric)
                        data.sort((a, b) => numeric_sort(a, b));
                    else
                        data.sort((a, b) => default_sort(a, b));
                }
                var realCount = count - NanCount;
                if (realCount > 1) {
                    if (realCount % 2) {
                        //dont add 1 because array is 0 indexed
                        this.medi = data[(parseInt(realCount / 2))];
                    }
                    else {
                        var a = data[(parseInt(realCount / 2) - 1)];
                        var b = data[(parseInt(realCount / 2))];
                        this.medi = (a + b) / 2;
                    }
                }
                else
                    //there can be only one 
                    this.medi = data[0];

                //if there is any data to display...
                if (rows.length !== NanCount) {
                    try {
                        var format = this.formatters[this.type].value;
                        this.sum = format(this.sum);
                        this.mean = format(this.mean);
                        this.medi = format(this.medi);
                    } catch {}
                }

                var format = this.formatters[this.type].format;

                return {
                    index: this.index,
                    sum: format(this.sum),
                    mean: format(this.mean),
                    median: format(this.medi),
                    type: this.type
                };
            }
        }
    }
}
);

Vue.component('table_header', {
    inject: ['formatters'],
    props: {
        ...common_props, ...{
            button_style: String,
            button_active_style: String,
            button_icon_style: String,
            data: Object
        }
    },
    mounted() {
        if (this.rendered) {
            //shove the first child component through a ref so we can use it
            //also let it know about us, its ancestor
            if (this.data.node.componentInstance) {
                this.$refs.child = this.data.node.componentInstance;
                if (this.$refs.child.$refs)
                    this.$refs.child.$refs.header = this;
            }
        }

        if (this.width) {
            //this.style.width = this.width;
            Vue.set(this.style, 'width', this.width);
            Vue.set(this.style, 'min-width', this.width);

        }
    },
    data() {
        var style = {};
        if (this.width) {
            style.width = this.width;
            style['min-width'] = this.width;
        }
        return {
            condensed: true,
            sortClasses: [this.button_style, this.button_icon_style],
            sortIcon: 'fa fa-fw fa-sort',
            sortState: 'unsort', //unsort -> asc -> desc -> unsort
            filterState: 'unfilter', //unfilter -> sens -> insens -> unfilter
            filter: false, //bool controlling appearance of input field
            ignoreCase: true,
            query: '',
            qp: this.name,
            queryButton: [this.button_style, this.button_icon_style],
            queryIcon: 'fa fa-fw fa-search',
            queryButtonText: '',
            showControls: true,
            style: style, //bound style overrides, default: none
        };
    },
    template: '#t_header',
    methods: {
        updateQuery() {
            //notify parent
            this.$emit('update:query', this);
        },
        sortReset: function (id) {
            //if we are not the newly current active sort column...
            if (this.index !== id) {
                this.sortState = 'unsort';
                this.sortIcon = 'fa fa-fw fa-sort';
                this.sortClasses = [this.button_style, this.button_icon_style];
                return true;
            }
            return false;
        },
        condensedFilter() {
            this.filterState = 'insens';
            this.ignoreCase = true;
            this.filter = true;
            this.qp = this.name;
        },
        showFilter() {
            switch (this.filterState) {
                case 'unfilter':
                    this.filterState = 'sens';
                    this.ignoreCase = false;
                    this.filter = true;
                    this.qp = 'Search Column (case sensitive)...';
                    this.queryButtonText = 'A!=a';
                    this.queryButton = this.button_active_style;
                    break;
                case 'sens':
                    this.filterState = 'insens';
                    this.ignoreCase = true;
                    this.qp = 'Search Column (case insensitive)...';
                    this.query = ''; //clear query so user sees new placeholder
                    this.queryButtonText = 'A=a';
                    this.queryButton = this.button_active_style;
                    break;
                case 'insens':
                    this.filterState = 'unfilter';
                    this.query = '';
                    this.ignoreCase = false;
                    this.filter = false;
                    this.queryButtonText = '';
                    this.queryButton = [this.button_style, this.button_icon_style];
                    break;
            }

        },
        transitSortState: function () {
            //sort state: unsorted -> asc -> desc -> unsorted
            switch (this.sortState) {
                case undefined:
                case 'unsort':
                    this.sortClasses = this.button_active_style;
                    if (this.numeric) {
                        this.sortIcon = 'fa fa-fw fa-sort-numeric-down';
                    } else {
                        this.sortIcon = 'fa fa-fw fa-sort-alpha-down';
                    }
                    this.sortState = 'asc';
                    break;
                case 'asc':
                    if (this.numeric) {
                        this.sortIcon = 'fa fa-fw fa-sort-numeric-up';
                    } else {
                        this.sortIcon = 'fa fa-fw fa-sort-alpha-up';
                    }
                    this.sortState = 'desc';
                    break;
                case 'desc':
                    this.sortIcon = 'fa fa-fw fa-sort';
                    this.sortState = 'unsort';
                    this.sortClasses = [this.button_style, this.button_icon_style];
                    break;
            }
            this.$emit('update:selected', this);
        }
    }
});


Vue.component('slotted_data', {
    props: {
        data: {
            type: Object,
            default: function () {
                //node is the root of a vnode tree, passed down from our ancestors
                return {
                    node: null,
                    component: null
                }
            }
        }
    },
    mounted() {
        //Awaken the Changeling
        //aka replace our el with the component we were given and
        //make us (this) its parent
        if (this.component) {
            this.$el.replaceWith(this.data.component.$el);
            this.data.component.$parent = this.$parent;
            for (descendant of this.data.component.$children) {
                descendant.$parent = this;
                this.$children.push(descendant);
                descendant.$forceUpdate();
            }
        }
    },
    render(h, context) {
        return this.data.node;
    }
});


Vue.component('slotted_table', {
    functional: true,
    data: function () {
        return {
            cache: [],
        };
    },
    props: {
        data: {
            type: Array,
            default: function () {return [];},
        }
    },
    render: function (h, context) {
        var rows = [];
        for (var row of context.props.data) { //this.data) {
            var record = [];
            for (var data of row) {
                record.push(data.node);
            }
            rows.push(h('tr', row.tr.data, record));
        }
        return h('tbody', rows);
    }
});


Vue.component('t_header', {
    //These headers never actually get ran through the Vue lifecycle,
    //they are just a convenient structure to pass data along
    props: common_props
});

const dyntab = Vue.component('dynamic_table', {
    beforeCreate: function () {
        if (typeof this.$table_formatters === 'undefined') {
            this.$table_formatters = table_formatters.formatters;
        }
        if (typeof this.$modify_formatters === 'undefined') {
            this.$modify_formatters = table_formatters.modify;
        }
        try {
            this.$modify_formatters(this.$options.propsData.append_formatters);
        } catch {}

        this.$emit("beforecreate");
    },

    created: function () {
        this.$emit("created");
    },
    beforeMount: function () {
        this.$emit("beforemount");
    },
    mounted: function () {
        this.$emit("mounted");
    },
    beforeUpdate: function () {
        this.$emit("beforeupdate");
    },
    updated: function () {
        this.$emit("updated");
    },
    beforeDestroy: function () {
        this.$emit("beforedestroy");
    },
    destroyed: function () {
        this.$emit("destroyed");
    },

    //provide instance formatters to descendants in case they've been modified locally
    provide: function () {
        this.log('provide debug: ' + this.debug);
        return {
            formatters: this.$table_formatters,
            log: this.log,
            error: this.error,
            warning: this.warning,
        }
    },
    template: '#t_main',
    props: {
        debug: {
            type: Boolean,
            default: false
        },
        append_formatters: {
            type: Object,
            default: undefined
        },
        order: {
            type: Number,
            default: -1
        },
        by: {
            type: String,
            default: 'asc'
        },
        data: Object,
        default_options: {
            type: Object,
            default: function () {
                return {
                    table_style: 'table table-sm table-light table-striped table-bordered table-hover',
                    thead_style: 'thead',
                    button_style: 'btn-light btn-sm font-weight-bold p-2',
                    button_active_style: 'btn-primary btn-sm active p-2',
                    button_icon_style: 'btn-just-icon',
                    footers: true,
                    show_totals: true, //show totals in footer
                    html: true, //Eval html in non-slotted tables
                    paginate: false, //false or number of records per page
                    csv: false, //show thead with export button?
                    keep_alive: false //keep component instances in table
                };
            }
        }
    },
    data() {
        var headers = [];
        var rows = [];
        var options = {};
        if (this.$slots.options) {
            options = parse_options(this.$slots.options, this);
        } else if (this.data && this.data.options) {
            options = this.data.options;
        } else {
            options = this.default_options;
        }
        if (this.$slots.headers) {
            headers = parse_headers(this.$slots.headers, this);
        } else if (this.data && this.data.headers) {
            headers = this.data.headers;
            for (var header of headers) {
                if (!header.type) {
                    header.type = (header.numeric || header.avg || header.sum) ? 'number' : 'default';
                }
            }
        }
        if (this.$slots.body || this.$scopedSlots.body) {
            if (this.$slots.body) {
                rows = this.parse_slots;
            } else {
                rows = this.parse_scoped_slots;
            }
        } else if (this.data && this.data.rows && (this.data.rows.length > 0)) {
            var key_idx = 0;
            const renderer = new elemConstructor2();
            for (var r = 0; r < this.data.rows.length; r++) {
                for (var d = 0; d < this.data.rows[r].length; d++) {
                    if (options && options.html) {
                        var node = this.$createElement('td', {
                            domProps: {
                                innerHTML: this.data.rows[r][d]
                            }
                        });
                    } else {
                        var node = this.$createElement('td', this.data.rows[r][d]);
                    }
                    //specify node key
                    node.key = key_idx;
                    node.context = this;

                    //pre-render element to extract text data for sorting
                    renderer.setData(node);

                    var text = (renderer.$el).innerText; //use innerHTML to search tags too

                    try {
                        var formatter = this.$table_formatters[headers[d].type];
                        text = formatter.value(text);
                    } catch {}

                    this.data.rows[r][d] = {
                        data: text,
                        node: node,
                        key: key_idx++,
                        //component: renderer
                    };
                }
            }
            renderer.$destroy(true);
            rows = this.data.rows;
        } else {
            rows = [];
        }

        var silent = () => {};

        return {
            headers: headers,
            rows: rows,
            options: options,
            orderby: this.order, //which column index to sort on
            dir: this.by, //which way to sort
            query: '', //only here to allow child to convince parent to redraw comp'd prop
            slots: [], //Array for slotted data,
            total: 0,
            page: 1, //current page counter
            pval: options.paginate, //temp for repagination
            //if any of these change we set page=1 on transformedRows update      
            previous_length: 0,
            previous_orderby: 0,
            previous_dir: 0,
            formatters: this.$table_formatters,
            log: (this.debug) ? console.log : silent,
            error: console.error,
            warning: (this.debug) ? console.warning : silent,
        };
    },
    computed: {
        pageCount: function () {
            var tr = this.transformedRows;
            if (this.options.paginate === false) {
                return 1; //no pagination implies there is only one page
            }
            var pagesize = parseInt(this.options.paginate);
            var fp = parseInt(tr.length / pagesize);
            var rem = tr.length % pagesize;
            var pc = (tr.length % pagesize !== 0 ? fp + 1 : fp);
            return pc;
        },
        pagedRows: function () {
            return this.transformedRows.slice(this.getStart(), this.getEnd() + 1);
        },
        transformedRows: function () {
            this.log('transformRows recompute');
            //copy array to avoid mutation
            var sorted = this.getRows().slice(0);
            var headers = this.getHeaders();
            var query = this.query;
            if (query) {
                //walk the children, looking for queries
                for (var child = 0; child < this.$children.length; child++) {
                    var chd = this.$children[child];

                    if (chd.rendered && chd.filter) {
                        //chd is a rendered header with a child component that is filtering our data
                        //this must use $refs instead of $attrs, or it will infinite loop
                        sorted = sorted.filter(elem => chd.$refs.child.filter(elem[chd.$vnode.key].data));
                    }
                    else
                        if (chd.filterable && chd.filter && (chd.query !== '')) {
                            sorted = sorted.filter(
                                function (elem) {
                                    try {
                                        //if the type has a formatter, we search the formatted value
                                        var format = chd.formatters[chd.type].format;
                                        var record = format(elem[chd.$vnode.key].data);
                                    } catch {
                                        var record = elem[chd.$vnode.key].data;
                                    }
                                    if (chd.ignoreCase)
                                        return record.toString().toLowerCase().includes(chd.query.toString().toLowerCase());
                                    else
                                        return record.toString().includes(chd.query.toString());

                                });
                        }
                }
            }

            /*filtering done, now check if we need to go back to page 1*/
            if (this.previous_length !== sorted.length ||
                this.previous_orderby !== this.orderby ||
                this.previous_dir !== this.dir) {

                //we've transformed, so force page back to one
                this.page = 1;
            }
            this.previous_length = sorted.length;
            this.previous_orderby = this.orderby;
            this.previous_dir = this.dir;


            //sort according to the currently active sort controller
            if (parseInt(this.orderby) >= 0) {
                if (headers[this.orderby] && headers[this.orderby].sortable) {
                    try {
                        var type = headers[this.orderby].type;
                        sorted.sort((a, b) => this.formatters[type].sort(a[this.orderby].data, b[this.orderby].data));
                    }
                    catch {
                        //no type? see if numeric is set
                        if (headers[this.orderby].numeric)
                            sorted.sort((a, b) => numeric_sort(a[this.orderby].data, b[this.orderby].data));

                        else
                            sorted.sort((a, b) => this.formatters.default.sort(a[this.orderby].data, b[this.orderby].data));
                    }
                    if (this.dir === 'desc')
                        sorted.reverse();
                }
            }

            return sorted;
        },
        parse_slots: function () {
            var slots = this.$slots.body;
            return this.parse_slots_inner(slots);
        },
        parse_scoped_slots: function () {
            var slots = this.$scopedSlots.body();
            return this.parse_slots_inner(slots);
        }
    },
    methods: {
        //for csv export
        printElement(elem, index, tagalong) {
            var formatter = (tagalong.headers && tagalong.headers[index]) ? tagalong.headers[index].formatter : tagalong.formatters.default;
            return this.quote(trim_string((formatter && formatter.hasOwnProperty('format')) ? formatter.format(elem) : elem));
        },
        quickPages: function () {
            var pc = this.pageCount;
            var qp = [];
            if (pc <= 7)
                return pc;

            if ((this.page - 3 > 0))
                qp.push(this.page - 3);
            if ((this.page - 2 > 0))
                qp.push(this.page - 2);
            if ((this.page - 1 > 0))
                qp.push(this.page - 1);
            qp.push(this.page);
            if (this.page + 1 < pc)
                qp.push(this.page + 1);
            if (this.page + 2 < pc)
                qp.push(this.page + 2);
            if (this.page + 3 < pc)
                qp.push(this.page + 3);
            return qp;
        },
        //Rudmentary escaping for csv generator
        quote: function (string) {
            var wrap = false;
            var quote = string.indexOf('"');
            var comma = string.indexOf(",");

            if (comma && (quote === -1)) {
                this.log(string, quote, comma);
                return '\"' + string + '\"';
            } else {
                return string;
            }

        },
        exportCSV: function (filename_prefix = 'export ', raw = false) {
            //based on https://codepen.io/dimaZubkov/pen/eKGdxN
            // and https://stackoverflow.com/a/24611096

            //sanitize filename prefix
            filename_prefix = filename_prefix.split(" ").join("_");

            var fullHeaders = this.getHeaders();
            var headers = fullHeaders.slice(0).map(h => this.quote(h.name.trim()));
            var transformedRowCopy = this.transformedRows.slice(0);

            //having formatters here allows the user to bind a formatter
            //to the default type and have it process all undefined types
            var tagalong = {headers: fullHeaders, formatters: this.formatters};

            var rows = transformedRowCopy.map(r => r.map((e, idx) => this.printElement(e.data, idx, tagalong)).join(","));

            let csv = [
                headers.join(","),
                rows.join("\n")

            ].join("\n");

            //we may want to call this internally for assembling spreadsheets
            if (raw)
                return csv;

            var csvData = new Blob([csv], {type: 'text/csv'});
            var csvUrl = URL.createObjectURL(csvData);

            let date = new Date();
            let date_format = (date.getMonth() + 1) + "-" + date.getDate() + "-" + date.getFullYear() + "_" + date.getHours() + "-" + date.getMinutes() + "-" + date.getSeconds();
            const link = document.createElement("a");
            link.setAttribute("href", csvUrl);
            link.setAttribute("download", ((filename_prefix) ? filename_prefix : "export_") + date_format + ".csv");

            link.click();
        },
        pageSize: function (pval) {
            return (pval === 'all') ? this.getRows().length : parseInt(pval);
        },
        repaginate: function (perPage) {
            this.options.paginate = this.pageSize(perPage);
            this.page = 1;
        },
        getPage: function () {
            return this.page;
        },
        getStart: function () {
            return (this.page - 1) * this.pageSize(this.options.paginate);
        },
        getEnd: function () {
            var tr_len = this.transformedRows.length - 1;
            var pg_end = (parseInt(this.page - 1) * this.pageSize(this.options.paginate)) + this.pageSize(this.options.paginate) - 1;
            return (pg_end >= tr_len ? tr_len : pg_end);
        },
        parse_slots_inner: function (slots) {
            var rows = [];
            var key_idx = 0;
            //we need header info to determine data type and potentially reformat data
            var headers = this.getHeaders();
            const createTextVNode = this._v;

            this.log('parse slots inner called');

            if (slots === undefined) {
                return [];
            }

            for (var tr of slots.filter(r => r.tag == 'tr')) {
                var row = [];
                row.tr = tr;
                var tds = tr.children.filter(d => d.tag == 'td');
                try {
                    for (var [index, elem] of tds.entries()) {

                        //each node is a <td>

                        // //We take ownership of the <td> and key it ...
                        // //but it's children are still in parent vue context
                        if (elem.key === undefined) {
                            elem.key = '' + this._uid + '_' + key_idx;
                        }
                        elem.context = this;
                        elem.parent = this._vnode;

                        if (elem.children && elem.children.length) {

                            if (this.options.keep_alive) {
                                if (elem.children[0].data) {
                                    elem.children[0].data.keepAlive = true;
                                }
                            }

                            if (elem.children[0]) {
                                elem.children[0].context = this;
                                elem.children[0].parent = this._vnode;
                            }

                            //key first child if it's unkeyed
                            if (elem.children[0] && (elem.children[0].key === undefined)
                                && elem.children[0].componentInstance)
                                elem.children[0].key = elem.children[0].componentInstance._uid;
                        }

                        //Support Explicit data binding
                        if (elem.data && elem.data.attrs && elem.data.attrs['data-sort-value']) {
                            var value = elem.data.attrs['data-sort-value'];
                        } else if (elem.children) {

                        var value = getChildrenTextContent(elem.children);
                        }
                        else {
                            var value =elem.text;
                        }

                        var formatter = (headers[index] && headers[index].formatter) ? headers[index].formatter : this.formatters.default;
                        value = formatter.value(value);
                        if (formatter.hasOwnProperty('format')) {
                            elem = this.$createElement('td', {
                                domProps: {
                                    innerHTML: formatter.format(value)
                                }
                            });
                        }

                        var record = {
                            data: value,
                            node: elem,
                            key: key_idx++,
                        };
                        row.push(record);
                    }
                    //ignore empty rows from malformed tables
                    if (row.length) {
                        rows.push(row);
                    }
                } catch (err) {
                    this.error(err);
                }
            }
            return rows;

        },
        getHeaders: function () {
            if (this.$slots.headers)
                return parse_headers(this.$slots.headers, this);
            return this.headers;
        },
        getRows: function () {
            if (this.$slots.body) {
                //this.slots = this.$slots.body; //not a func
                this.total = this.parse_slots.length;
                return this.parse_slots;
            } else if (this.$scopedSlots.body) {
                //this.slots = this.$scopedSlots.body(); //scopedslots is func
                return this.parse_scoped_slots;
                this.total = this.parse_scoped_slots.length;
            } else if (this.rows) {
                this.total = this.rows.length;
                return this.rows;
            } else {
                this.total = 0;
                return [];
            }
        },
        updateQuery: function (que = {}) {
            //modify this parent prop so table re-renders
            this.query = que.query;
        },
        updateSelected: function (ent = {}) {
            //ent.index corresp. to header index value
            for (var child = 0; child < this.$children.length; child++) {
                // notify sibling ', child ,' of new active column', ent.index
                if (typeof (this.$children[child].sortReset) === "function") {
                    this.$children[child].sortReset(ent.index);
                }
            }
            switch (ent.sortState) {
                case 'asc':
                case 'desc':
                    this.orderby = ent.index;
                    this.dir = ent.sortState;
                    break;
                case 'unsort':
                    //cleanup
                    this.orderby = -1;
                    this.dir = 'asc';
                    break;
            };
        },
        columnCount: function () {
            return this.getHeaders().length;
        },
        shownRecords: function () {
            return this.transformedRows.length;
        },
        totalRecords: function () {
            return this.getRows().length;
        }
    }

}
);

// const functionalRenderer = Vue.extend({
//     functional: true,
//     props: [
//         'node'
//     ],
//     render(h, context) {
//         return context.props.node ? context.props.node : null;
//     }
// });

const elemConstructor = Vue.extend({
    props: [
        'node'
    ],
    data: function () {
        return {
            mutable: this.node,
        };
    },
    methods: {
        setData: function (node) {
            this.mutable = node;
            this._update(node);
            //this.$el = this.__patch__(this._vnode,node,undefined,false);
        }
    },
    render(h, context) {
        return this.mutable ? this.mutable : '';
    }
});

/*
Quick and dirty variant for data extraction, renders nothing
*/
const elemConstructor2 = Vue.extend({
    methods: {
        setData: function (node) {
            this.$el = this.__patch__(this._vnode, node, undefined, false);
        }
    },
    render(h, context) {
        return null;
    }
});

function parse_options(slots, me) {
    var options = me.default_options;
    for (var o = 0; o < slots.length; o++) {
        if (slots[o].tag == 'option') {
            var key = slots[o].data.attrs.name;
            var value = slots[o].data.attrs.value;
            //special casing
            switch (value) {
                case "false":
                    value = false;
                    break;
                case "true":
                    value = true;
                    break;
            }
            options[key] = value;
        }
    }
    return options;
}

function parse_headers(slots, thisRef) {
    var headers = [];

    //headers are of type t_header, which is a do nothing component that accepts a subset of the real
    //table header component's props. this allows us to create components from markup passed in from the parent.
    //while we're here, we manipulate the header data for internal consistancy
    //and expand the created header with metadata

    for (var h = 0; h < slots.length; h++) {
        //populate default props

        var header = {};
        for (prop in common_props) {
            header[prop] = common_props[prop].default;
        }

        var slot = slots[h];
        try {
            if (slot.componentOptions.tag == 't_header') {
                //if header elem is a component with tag t_header...
                try {
                    //try getting name from t_header default slot
                    //this may be overridden by the name prop below
                    header.name = slot.componentOptions.children[0].text.trim();
                } catch {};

                //next consider props that may be bound to the t_header
                try {
                    for (var prop in slot.componentOptions.propsData) {
                        if (common_props[prop].type == Boolean) {
                            //empty string evaluates as true to support attrs/valueless prop notation
                            ([true, ''].indexOf(slot.componentOptions.propsData[prop]) > -1)
                                ? header[prop] = true : header[prop] = false;
                        } else {
                            header[prop] = slot.componentOptions.propsData[prop];
                        }
                    }
                } catch {};

                //special case: proxy bound classes
                header.class = [slot.data.staticClass, slot.data.class];

                //for known numeric data types, force numeric to true
                //for known date-like types, force totals off
                //no type? make it default
                switch (header.type) {
                    case 'date':
                    case 'datepicker':
                    case 'datetime':
                    case 'timestamp':
                        header.total = false;
                    case 'computednumber':
                    case 'number':
                    case 'dollar':
                        header.numeric = true;
                    //default:
                    //    header.type = 'default';
                }

                if (header.type == 'default' &&
                    (header.avg || header.total || header.median)) {
                    //must be a number?
                    header.type = 'number';
                    header.numeric = true;
                }

                //if the header is rendered, ensure it has 1 or less root nodes
                if (header.rendered) {
                    try {
                        switch (slot.componentOptions.children.length) {
                            default:
                                //more than 1 is an error, then fallthrough
                                this.error("Rendered children must have a single root node. Discarding siblings.");
                            case 1:
                                //1 Child OK, draw it
                                header.data = {
                                    node: slot.componentOptions.children[0],
                                    //component: new elemConstructor({ propsData: { node: slot.componentOptions.children[0] } }).$mount()
                                };
                                break;
                        }
                    } catch {
                        //The Zero Case: No Children? OK, we draw nothing
                        header.data = {node: ''};
                    };
                }

                //bind our formatter
                // try {
                header.formatter = thisRef.formatters[header.type];
                // }
                // catch {
                //     header.formatter = this.formatters.default;
                // }

                headers.push(header);
            }
        } catch { //not a t_header
            continue;
        }
    }
    return headers;
}


function format_number(a) {
    if (isNaN(a))
        return '';
    else
        return Number(a).toLocaleString("en-US", {maximumFractionDigits: 2}); //, minimumFractionDigits: 2
}

function format_date(date) {
    var d = new Date(date);
    if (!date || isNaN(d)) {
        return '';
    }
    return d.toLocaleDateString();
};

function format_datetime(date) {
    var d = new Date(date);
    if (!date || isNaN(d)) {
        return '';
    }
    return d.toLocaleDateString() + ' ' + d.toLocaleTimeString();
};

function format_time(date, options = {hour: '2-digit', minute: '2-digit'}) {
    var d = new Date(date);
    if (!date || isNaN(d)) {
        return '';
    }
    return d.toLocaleTimeString([], options);
}

const dollar_number_formatter = new Intl.NumberFormat('en-us', {
    style: 'currency',
    currency: 'USD',
    minimumFractionDigits: 2
});

function format_dollar_value(value) {
    if (isNaN(value)) {
        return '';
    }
    return dollar_number_formatter.format(value);
};

function digits_period_only(val) {
    if (typeof val === 'string') {

        if ([''].indexOf(val.trim()) > -1) {
            val = undefined;
            return val;
        }

        //strip non-digits for sort value
        //ref: https://stackoverflow.com/questions/36321409
        return Number(val.replace(/[^0-9.]/g, '').replace(/(\..*)\./g, '$1'));
    }
    else return val;
};

function date_as_timestamp(date) {
    var parsed_date = Date.parse(new Date((date)));
    return (isNaN(parsed_date) || !parsed_date) ? null : parsed_date;
}

function default_sort(a, b) {
    return lexical_insensitive(a, b);
}

function numeric_sort(a, b) {
    /*using == so nulls get the same treatment */
    if (a == undefined) {
        if (b == undefined)
            return 0;
        else
            return 1;

    }
    else if (b == undefined) {
        return -1;
    }
    else
        return a - b;
}

function lexical_insensitive(a, b) {
    return a.toString().toUpperCase().localeCompare(b.toString().toUpperCase());
}

function lexical_sensitive(a, b) {
    return a.toString().localeCompare(b.toString());
}

function noop(a) {return a;}

function trim_string(a) {return String(a).trim();}
