<template id="t_main">
    <div id="dynamic_table">
        <table v-bind:class="options.table_style">
            <template v-if="options.csv">
                <thead v-bind:class="options.thead_style">
                    <div class="btn-group">
                        <button class="btn btn-outline-primary m-2" v-on:click="exportCSV()">
                            <i class="fa fa-table"></i> Export to CSV
                        </button>
                    </div>
                </thead>
            </template>

            <thead v-if="$slots.fixed_top">
                <tr>
                    <!--
            using slotted_data renderer component to avoid slot getting kicked out of table due to element restrictions.
            Here we loop over the vnodes (Vue rendered from parent) passed into slot 'fixed_head', and simply render them as is.
            the key exists to help Vue preserve ordering/reactivity, as suggested by docs.
                    -->
                    <th v-for="(data, key) in $slots.fixed_top" is="slotted_data" v-bind:data="{node: data}" v-bind:key="key" />
                </tr>
            </thead>
            <thead v-bind:class="options.thead_style">
                <!-- <transition name="slide"> -->
                <tr>
                    <th is="table_header" v-for="(header, index) in getHeaders()" :key="index" v-bind="header" :index="index" :button_style="options.button_style" :button_icon_style="options.button_icon_style" :button_active_style="options.button_active_style" v-on:update:query="updateQuery($event)" v-on:update:selected="updateSelected($event)" />
                </tr>
                <!-- </transition> -->
            </thead>
            <thead v-if="$slots.fixed_head">
                <tr>
                    <!-- Same as above -->
                    <th v-for="(data, key) in $slots.fixed_head" is="slotted_data" v-bind:data="{node: data}" v-bind:key="key" />
                </tr>
            </thead>

            <!-- <tbody>
                <template v-if="options.paginate">
                    <tr v-for="row in pagedRows">
                        <template v-for="data in row">
                            <td is="slotted_data" v-bind:data="data" :key="data.key" />
                        </template>
                    </tr>
                </template>
                <template v-else>
                    <tr v-for="row in transformedRows">
                        <template v-for="data in row">
                            <td is="slotted_data" v-bind:data="data" :key="data.key" />
                        </template>
                    </tr>
                </template>
            </tbody> -->


            <!-- <tbody>
                <tr v-for="row in (options.paginate)? pagedRows: transformedRows">
                    <template v-for="data in row">
                        <td is="slotted_data" v-bind:data="data" :key="data.key" />
                    </template>
                </tr>
            </tbody>  -->


            <!-- needs more debugging wrt kept-alive components -->
            <tbody is='slotted_table' :data="(options.paginate)? pagedRows: transformedRows" :keepalive="options.keep_alive==true" />


            <thead v-if="options.footers" v-bind:class="options.thead_style">
                <tr>
                    <td is="table_footer" v-for="(header, index) in getHeaders()" v-bind="header" :key="index" :index="index" />
                </tr>
            </thead>
            <!--            <thead v-bind:class="options.thead_style" v-bind:colspan="columnCount()">
                        </thead>-->
            <thead v-bind:class="options.thead_style">
                <th v-if="options.paginate" v-bind:colspan="columnCount()">
                    <div v-if="options.paginate" class="d-flex flex-row">
                        <div class="mr-auto form-inline">
                            <label class="label mb-0 label-sm">Pagesize:</label>
                            <span class="bmd-form-group pl-1 py-0 is-filled">
                            <select class="form-control input-xs" v-model="pval" v-on:change="repaginate(pval)">
                                <option active value="10">10</option>
                                <option value="20">20</option>
                                <option value="50">50</option>
                                <option value="100">100</option>
                                <option value="all">All</option>
                            </select>
                            </span>
                        </div>
                        <div class="flex-grow-1 d-flex justify-content-center align-items-center">
                            <label v-if="shownRecords() != totalRecords()" class="label label-default">Showing
                                {{getStart()+1}} to {{getEnd()+1}} from {{shownRecords()}} of {{totalRecords()}}
                                records.</label>
                            <label v-else class="label label-default">Showing {{getStart()+1}} to {{getEnd()+1}} of
                                {{totalRecords()}} records.</label>
                        </div>
                        <div v-if="pageCount > 1" class="ml-auto btn-group">
                            <button class="btn btn-sm" v-bind:class="options.button_style" v-on:click="page = 1;">First</button>
                            <button class="btn btn-sm" v-bind:class="options.button_style" v-on:click="page = (page > 1? page-1 : 1);">Prev</button>
                            <button class="btn btn-sm" v-bind:class="((page === p)?' options.button_active_style' : options.button_style)" v-for="p in quickPages()" v-on:click="page = p;">{{p}}</button>
                            <button class="btn btn-sm" v-bind:class="options.button_style" v-on:click="page = (page < pageCount? page+1 : pageCount);">Next</button>
                            <button class="btn btn-sm" v-bind:class="options.button_style" v-on:click="page = pageCount;">Last</button>
                        </div>
                </th>
                <th v-if="!options.paginate && options.show_totals" v-bind:colspan="columnCount()">
                    <div class="d-flex flex-row">
                        <div class="mr-auto">Showing {{shownRecords()}} of {{totalRecords()}} records.</div>
                        <div class="flex-grow-1"></div>
                        <div class="ml-auto">Showing {{shownRecords()}} of {{totalRecords()}} records.</div>
                    </div>
                </th>
            </thead>
        </table>
    </div>
</template>

<template id="t_header">
    <th style="vertical-align:top;" :style="style">
        <!--  -->
        <div v-if="!this.rendered" class="d-flex flex-column">
            <div class="d-flex flex-row">
                <!-- <transition name="fade"> -->
                <div v-if="filterable && condensed" :class="'d-flex w-100 btn-group ' + (($parent.options.wrapper_style) ? $parent.options.wrapper_style : '') ">
                    <div class="w-100">
                        <!-- Hack to make input minwidth the same as if it were a button -->
                        <div style="visibility:hidden;height:0">
                            <button class="w-100 flex-shrink-1 btn" v-on:click="showControls = !!showControls;" v-bind:class="button_style">
                                {{name}}
                            </button>
                        </div>
                        <input class="flex-shrink-1 font-weight-bold form-control form-control-sm" style="min-width:3em;margin-top:0em" data-toggle="tooltip" data-placement="top" v-bind:title="name.trim()" v-model="query" v-on:change="filter= true" v-on:click="condensedFilter()" v-on:input="updateQuery()" v-bind:placeholder="name.trim()" v-bind:tip="name.trim()" />
                    </div>

                    <button class="ml-auto btn" :class="[sortClasses, button_icon_style]" v-if="(sortable && showControls)" v-on:click="transitSortState()">
                        <i :class="sortIcon"></i>
                        <!--&nbsp;Sort-->
                    </button>
                </div>
                <div v-else class="d-flex w-100 btn-group">
                    <button class="w-100 flex-shrink-1 btn" v-on:click="showControls = !!showControls;" v-bind:class="button_style">
                        {{name}}
                    </button>
                    <button class="ml-auto btn" v-bind:class="queryButton" v-if="(filterable && showControls)" v-on:click="showFilter()">
                        <i :class="[queryIcon, button_icon_style]"></i>{{queryButtonText}}</button>
                    <button class="ml-auto btn" v-bind:class="sortClasses" v-if="(sortable && showControls)" v-on:click="transitSortState()">
                        <i :class="[sortIcon, button_icon_style]" v-bind:class="sortIcon"></i>
                        <!--&nbsp;Sort-->
                    </button>
                </div>
                <!-- </transition> -->
            </div>
            <template v-if="filterable && !condensed">
                <!-- <transition name="fade"> -->
                <div class="d-flex flex-row">
                    <input class="flex-shrink-1 form-control" style="min-width:0;margin-top:1em" v-if="filter" v-model="query" v-on:input="updateQuery()" v-bind:placeholder="qp" />
                </div>
                <!-- </transition> -->
            </template>
        </div>
        <div v-else>
            <slotted_data v-bind:data="this.data"></slotted_data>
        </div>
    </th>
</template>

<template id="t_footer">
    <th>
        <div class="d-flex flex-column">
            <div v-if="total && results && !isNaN(results.sum) && !supress_totals">Total: {{results.sum}}</div>
            <div v-if="avg && results && !isNaN(results.mean)">Average: {{results.mean}}</div>
            <div v-if="median && results && !isNaN(results.median) ">Median: {{results.median}}</div>
        </div>
    </th>
</template>