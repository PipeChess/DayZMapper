Vue.component('expand', {
    template: `<button :class="$attrs.class" @click="expanded=!expanded" :aria-expanded="expanded"> {{ (expanded)?lessText:moreText }} </button>`,
    props: {
        debug: {
            type: Boolean,
            default: false
        },
        less: {
            type: String,
            default: 'Less'
        },
        more: {
            type: String,
            default: 'More'
        },
    },
    data() {
        var logger = (this.debug) ? console : {
            warn: () => { },
            error: () => { },
            log: () => { },
        };
        this.warn = logger.warn;
        this.error = logger.error;
        this.log = logger.log;

        return {
            ready: false,
            expanded: false,
            tr: document.createElement('tr'),
            td: document.createElement('td'),
            row: null,
            logger: logger,
            lessText: (this.debug) ? this._uid + ' |' + this.less : this.less,
            moreText: (this.debug) ? this._uid + ' |' + this.more : this.more,
        };
    },

    beforeDestroy() {
        this.log('expand ' + this._uid + ' beforeDestroy()');
        //close if we were open
        if (this.expanded) {
            this.expanded = false;
        }
        //perform close action explicitly if we die before the watcher fires
        if (this.tr && this.tr.parentNode) {
            this.tr.parentNode.removeChild(this.tr);
        }
    },
    deactivated() {
        this.log('expand ' + this._uid + ' deactivated()');
        //if we're deactivating, remove our extra tr from our grandparent tr
        //note that we don't touch this.expanded, this preserves state across
        //sorts of the table
        if (this.tr && this.tr.parentNode) {
            this.tr.parentNode.removeChild(this.tr);
        }
    },

    activated() {
        this.log('expand ' + this._uid + ' activated()');

        //if we are reactivated, and we were previously out..
        //turn it off and on again so the table moves to our new location
        if (this.expanded) {
            this.expanded = false;
            this.$nextTick(() => {this.expanded = true});
        }
    },
    mounted() {
        this.log('expand ' + this._uid + ' mounted()');
    },
    watch: {
        expanded(e) {
            if (e && this.$el.parentElement) {
                this.row = this.$el.parentElement.parentElement;

                if (!this.ready) {
                    var contents = new elemConstructor({propsData: {node: this.$slots.default}}).$mount();

                    /*if we rendered a component, we own it now.
                    This makes our expand content visible in the Vue Debugger */
                    if (Array.isArray(contents.$children) && contents.$children.length) {
                        contents.$children[0].$parent = this;
                        this.$children.push(contents.$children[0]);
                    }

                    this.td.append(contents.$el);
                    this.tr.append(this.td);
                    this.ready = true;
                }
                this.$el.parentElement.classList.add("show");
                this.td.setAttribute("colspan", this.row.childElementCount);
                this.td.classList.add("p-0");
                this.row.insertAdjacentElement('afterend', this.tr);
            }
            else if (this.$el && this.tr.parentNode) {
                this.$el.parentElement.classList.remove("show");
                this.tr.parentNode.removeChild(this.tr);
            }
        }
    }
})


Vue.component('select-filter', {
    props: {
        debug: {
            type: Boolean,
            default: false
        },
        choices: {
            type: [Object, Array],
            required: true,
        },
        multiple: {
            type: Boolean,
            default: false
        },
        mdb_hack: {
            type: Boolean,
            default: false
        }
    },
    data: function () {
        var logger = (this.debug) ? console : {
            warn: () => { },
            error: () => { },
            log: () => { },
        };
        this.warn = logger.warn;
        this.error = logger.error;
        this.log = logger.log;
        return {
            shown: false,
            selections: [],
            choicefilter: null,
            button_style: 'btn',
        };
    },
    //these variables changing will cause this component's update method to run
    watch: {
        multiselect: function () {this.update()},
        selections: function () {this.update()},
    },
    computed: {
        visible_choices: function () {
            //active selections are the intersection of current choices and current selections
            var active_selections = this.choices.filter(x => this.selections.includes(x));

            //filtered choices are current choices, conditionally matching the filter text disregarding case
            var filtered_choices = this.choices.filter(x => (this.choicefilter) ? x.toLowerCase().includes(this.choicefilter.toLowerCase()) : true)

            //visible_choices are the unique union of the two sets
            return [...new Set([...active_selections, ...filtered_choices])];

        }
    },

    mounted() {
        //this is a hack. fixes the buttons glitching at initial load.
        if (this.$parent && this.$parent.$parent && this.$parent.$parent.button_style)
            this.button_style = this.$parent.$parent.button_style;
    },

    methods: {
        query: function () {
            //the idea here is to generate mongodb query pieces analagous to our filter func.
            //not used yet
            var start = this.val1;
            var end = (this.range) ? this.val2 : this.val1;
            var q = {$range: [start, end,]};
            return q;
        },
        filter: function (datapoint) {
            this.log(['filter', datapoint, this.multiselect, this.selections]);
            //intersection of selections and current choice list
            var active_selections = this.choices.filter(x => this.selections.includes(x));
            if (active_selections.length == 0) {
                return true;
            }
            return active_selections.includes(datapoint.trim());
        },
        update: function () {
            this.log('select-filter updated');
            //this.$refs.header will exist if we are a descendent of a coopTables table_header component
            if (this.$refs.header) {
                var header = this.$refs.header;
                //this appproach doesn't work, causes infinite loop in table recalc func
                //header.$attrs.formatter.filter = this.filter;

                //our header ancestor is now in filtering mode
                header.filter = true;
                //with a non empty string query
                header.query = !'';
                //and 
                header.updateQuery();
            }
        }
    },
    template: `<div class=" dropdown w-100 flex-grow-1">
    <div class="btn-group w-100 flex-grow-1">
    <button type="button" @click="shown =! shown" :class="(($refs.header)? ( (selections.length ) ? $refs.header.button_active_style: $refs.header.button_style) : button_style) + ' ' + 'btn w-100 dropdown-toggle dropdown-toggle-split'"  aria-haspopup="true" :aria-expanded="!shown"><slot></slot><span class="sr-only">Toggle Dropdown</span></button>

    <template v-if="$refs.header">
    <button class="ml-auto btn" :class="[$refs.header.sortClasses, $refs.header.button_icon_style]" v-if="($refs.header.sortable && $refs.header.showControls)" v-on:click="$refs.header.transitSortState()">
        <i :class="$refs.header.sortIcon"></i>
    </button>
    </template>
    </div>

    <ul :class="(shown)?'show':''" class="pt-0 dropdown-menu dropdown-menu-right">
    <li class="p-0 my-0 btn-group w-100"> <button class="btn btn-outline btn-xs  m-0 w-100" @click="selections = [];">Reset</button>
    
    <button class="btn btn-outline btn-xs flex-shrink-1" @click="shown = false">Close</button>

    </li>
    <li v-if="$refs.header && $refs.header.filterable" class="form-group form-inline pt-0"><input class="form-control  px-3 flex-grow-1 mr-auto" v-model="choicefilter" placeholder="filter..."></input>
    <button v-if="$refs.header && $refs.header.filterable && choicefilter" class="form-control btn flex-shrink-1 text-danger" @click="choicefilter = null"><i class="fa fa-times"></i></button></li>

    <li v-for="choice in visible_choices" class="checkbox w-100">
    <label class="label mb-1 text-small"><input type="checkbox" :key="choice" :value="choice" v-model="selections">
    <span v-if="mdb_hack" class="checkbox-decorator"><span class="check"></span><div class="ripple-container"></div></span>
     {{ choice }}</label>
    </li>

    </ul>
  </div>`,

})

//    <li><a href="#" class="small" :data-value="choice" tabIndex="-1"><input type="checkbox" :value="choice" v-model="selections" />&nbsp;{{ choice }}</a></li>


Vue.component('range-filter', {
    props: {
        debug: {
            type: Boolean,
            default: false
        },
    },
    data: function () {
        var logger = (this.debug) ? console : {
            warn: () => { },
            error: () => { },
            log: () => { },
        };
        this.warn = logger.warn;
        this.error = logger.error;
        this.log = logger.log;
        return {
            shown: false,
            range: true, //single value or range
            val1: 0,
            val2: 100
        };
    },
    //these variables changing will cause this component's update method to run
    watch: {
        range: function () {this.update()},
        val1: function () {this.update()},
        val2: function () {this.update()},
    },

    methods: {
        query: function () {
            var start = this.val1;
            var end = (this.range) ? this.val2 : this.val1;
            var q = {$range: [start, end,]};
            return q;
        },
        filter: function (datapoint) {
            this.log(['filter', datapoint, this.val1, this.val2]);
            var test = Number(datapoint);
            var val1 = Number(this.val1);
            var val2 = Number(this.val2);
            if (this.range) {
                return ((val1 <= test) && (test <= val2));
            }
            else {
                return (test == val1);
            }
        },
        update: function () {
            this.log('range-filter updated');
            //this.$refs.header will exist if we are a descendent of a coopTables table_header component
            if (this.$refs.header) {
                var header = this.$refs.header;
                //this appproach doesn't work, causes infinite loop in table recalc func
                //header.$attrs.formatter.filter = this.filter;

                //our header ancestor is now in filtering mode
                header.filter = true;
                //with a non empty string query
                header.query = !'';
                //and 
                header.updateQuery();
            }
        }
    },
    template: `<div class="btn-group dropup w-100">
    <button type="button" class="w-100 btn btn-danger"><slot></slot></button>
    <button type="button" @click="shown =!shown" class="btn btn-danger dropdown-toggle dropdown-toggle-split" aria-haspopup="true" aria-expanded="false">
      <span class="sr-only">Toggle Dropdown</span>
    </button>
    <div :class="(shown)?'show':''" class="dropdown-menu dropdown-menu-right">
    <div class="dropdown-item">
    <div class="custom-control custom-switch">
  <input v-model="range" type="checkbox" class="custom-control-input" :id="_uid+'_switch'">
  <label class="custom-control-label" :for="_uid+'_switch'">Single Value/Range</label>
</div>
</div>
    <div class="dropdown-divider"></div>
    <div class="input-group mb-2 mr-sm-2">
    <div class="input-group-prepend w-75">
      <div class="input-group-text">Single/Lower Value</div>
    </div>
    <input v-model="val1" type="number" class="form-control w-25">
  </div>
  <div class="input-group mb-2 mr-sm-2">
  <div class="input-group-prepend w-75">
    <div class="input-group-text">Upper Value</div>
  </div>
  <input :disabled="!range" v-model="val2" type="number" class="form-control w-25">
</div>
    </div>
  </div>`,

})