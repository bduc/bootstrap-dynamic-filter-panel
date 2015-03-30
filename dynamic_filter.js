;(function ($, _, window, document, undefined) {
    "use strict";
    
    var DynamicFilter = function (element, options) {
        this.container = $(element);

        var template = '' +
        '<div class="dynamic-filter">'+
            '<div class="field-selector col-sm-2 pull-right">' +
                '<div class="input-group  pull-right">' +
                    '<div class="input-group ">' +
                        '<div class="input-group-btn">' +
                            '<button tabindex=-1 type="button" class="btn btn-default dropdown-toggle" data-toggle="dropdown">' +
                                '<span class="fa fa-plus"></span> Field '+
                                '<span class="fa fa-caret-down"></span>' +
                            '</button>' +
                            '<ul class="dfw-field-list dropdown-menu" role="menu">' +
                            '</ul>' +
                            '<button tabindex=-1 class="dfw-remove-filters btn btn-default" type="button">' +
                                '<span class="fa fa-minus"></span>' +
                            '</button>' +
                        '</div>' +  
                        '<div class="input-group-btn">' +
                            '<button tabindex=-1 class="btn btn-default dropdown-toggle" type="button" data-toggle="dropdown">' +
                                '<span class="fa fa-save"></span>' +
                            '</button>' +
                            '<ul class="dropdown-menu dfw-save-menu" role="menu">' +
                                '<li><a class="dfw-save" href="javascript: false;"><span class="fa fa-save"></span> Save</a></li>' +
                                '<li class="divider"></li>' +
                                '<li class="dfw-preset dropdown-header">Presets</li>' +
                                '<li class="dfw-saved  dropdown-header">Saved</li>' +
                            '</ul>' +
                            '<button tabindex=-1 class="btn btn-default" type="submit">' +
                                '<span class="fa fa-search"></span>' +
                            '</button>' +
                        '</div>' +
                    '</div>' +
                '</div>' +
            '</div>' +
            '<div class="clearfix"></div>' +
        '</div>';

        //custom options
        if (typeof options !== 'object' || options === null)
            options = {};

        this.container.html(template);
        this.root = this.container.find('.dynamic-filter').first();
        
        this.submit_button = this.root.find("button[type='submit']");
        
        this.setOptions(options);

        this.restoreState();

        var self = this;
        var debouncedSubmit = _.debounce( function() {
            self.submit_button.trigger('click');
        }, 400);
        
        this.root
            .on('click.dynamic_filter', 'ul.dfw-field-list > li > a', 
                $.proxy(function( event ) {
                    event.preventDefault();
                    var f = this.addField( $(event.target).data('field') );
                    f.find('input.form-control').focus();
                },this))
            
            .on('click.dynamic_filter', 'button.dfw-remove-filters',
                $.proxy(function(event){
                    event.preventDefault();
                    this.removeAllFields();
                    this.loadFilter(this.persistent_filter);
                    this.root.find(".filter-element input").first().focus();
                    self.submit_button.trigger('click');
                }, this) )

            .on('click.dynamic_filter', 'a.dfw-save',
                $.proxy(function( event ) {
                    event.preventDefault();
                    var name = prompt("Enter name:")
                    this.saveFilter( name );
                    this.saveState();
                }, this) )
    
            .on('click.dynamic_filter', 'ul.dfw-save-menu > li > a[data-preset]',
                $.proxy(function( event ) {
                    event.preventDefault();
                    this.loadPresetFilter( $(event.target).data('preset') );
                    self.submit_button.trigger('click');
                },this) )

            .on('click.dynamic_filter', 'ul.dfw-save-menu > li > a[data-saved]',
                $.proxy(function( event ) {
                    event.preventDefault();
                    this.loadSavedFilter( $(event.target).data('saved') );
                    self.submit_button.trigger('click');
                },this) )
            .on('click.dynamic_filter', 'ul.dfw-save-menu > li > a > span.fa-trash',
                $.proxy(function( event ) {
                    event.preventDefault();
                    var name = $(event.target).closest("a[data-saved]").data('saved');
                    
                    if( confirm("Are you sure you want to remove " + name + "?") ) {
                        this.removeFilter(name);
                    } 
                },this) )

            .on('click.dynamic_filter',  '.filter-element a.dfw-field-action', 
                $.proxy(this.onFieldAction,this) )
            
            .on('change.dynamic_filter',  '.filter-element input',
                $.proxy(function( event ) {
                    var wrapper_el = $(event.target).closest('.filter-element');
                    this.adjustFieldAction( wrapper_el );
                    var field = wrapper_el.data('field');
                    this.submit_button.removeClass('btn-default').addClass('btn-primary');
                    //if( field == 'quick' ) {
                    //    debouncedSubmit();
                    //}
                },this) )

            .on('keyup.dynamic_filter',  '.filter-element input', 
                $.proxy(function( event ) {
                    var wrapper_el = $(event.target).closest('.filter-element');
                    this.adjustFieldAction( wrapper_el );
                    var field = wrapper_el.data('field');
                    //this.submit_button.removeClass('btn-default').addClass('btn-primary');
                    if( field == 'quick' ) {
                        debouncedSubmit();                    
                    }
                },this) )
            
            .on('click.dynamic_filter',  'button[type=submit]',
                $.proxy(function( event ) {
                    this.submit_button.removeClass('btn-primary').addClass('btn-default');
                    this.saveState();
                },this) )
                    
            .on('click.dynamic_filter',  '.dfw-field-op-list a', 
                $.proxy(this.onChangeFieldOp,this) )
    };

    DynamicFilter.prototype = {
        constructor: DynamicFilter


        ,setOptions: function(options) {
            this.state_id = options.state_id;
            
            if( _.isObject(options.fields) )
                this.setFieldSpecs(options.fields);
            
            if(_.isArray(options.preset_filters) )
                this.setPresetFilters(options.preset_filters);

            if(_.isArray(options.saved_filters) )
                this.setSavedFilters(options.saved_filters);

            if( options.store )
                this.store = options.store;
            else
                this.store = window.store;
            
            if(_.isArray(options.persistent_filter) ) {
                this.persistent_filter = $.extend(true, [], options.persistent_filter);
                this.loadFilter(this.persistent_filter);
            } else {
                this.persistent_filter = [];
            }

            if( _.isObject(options.state) ) {
                this.applyState(options.state);
            }
            
            if( _.isObject(options.params) && _.isObject(options.params.f) ) {
                this.loadFilter(options.params.f);
            }
        }

        ,setFieldSpecs: function( fields ) {
            var el = this.root.find('ul.dfw-field-list');
            this.fields_specs = fields;
            for( var field in this.fields_specs ) {
                var label = this.fields_specs[ field ].label || field;
                $('<li><a data-field="' + field + '" href="javascript: false;">' + label + '</a></li>').appendTo( el );
            }
        }
        
        ,setPresetFilters: function( filters ) {
            var menu_el = this.root.find('ul.dfw-save-menu');
            
            menu_el.find("a[data-preset]").closest('li').remove();

            var header_el = menu_el.find("li.dfw-preset");
            
            this.preset_filters = [];

            var markup = '';
            _.each(filters,function( filter ) {
                this.preset_filters.push( $.extend({},filter) );
                markup += '<li><a data-preset="' + filter.name + '" href="javascript: false;"><span class="fa fa-fw"></span>' + filter.name + '</a></li>';            
            },this);
            
            $(markup).insertAfter(header_el);
        }
        
        ,loadFilter: function( filter_fields ) {
            // if loadFilter is called on a empty container than I expect you're loading persistent-filter
            // if it's not empty than persistent fields are not load again
            var check_persistent_fields = this.root.find(".filter-element").length > 0;
            _.each( filter_fields ,function( filter_field ){
                if(check_persistent_fields && _.find(this.persistent_filter,function( persistent_field ) { return persistent_field.f == filter_field.f } ) ) {
                    var f_el = this.root.find('.filter-element[data-field="'+filter_field.f+'"]');

                    var $input = f_el.find('input.dfw-field-value');
                    var field_spec = this.getFieldSpec( filter_field.f );

                    if( _.isObject(field_spec.select2) ) {
                        $input.select2('data',filter_field.v);
                    } else {
                        $input.val(filter_field.v).trigger('change');
                    }

                } else {
                    this.addField(filter_field.f, filter_field.o, filter_field.v);
                }
            },this);
        }

//        ,markFilter: function( name ) {
//            var filter = _.find(this.preset_filters,function(filter) { return filter.name == name } );
//            if( filter ) {
//                this.root.find('ul.dfw-save-menu > li > a > span.fa-check').removeClass('fa-check');
//                this.root.find('ul.dfw-save-menu > li > a[data-preset="' + name + '"] > span.fa').addClass('fa-check');
//                this.root.find('ul.dfw-save-menu > li > a[data-saved="' + name + '"] > span.fa').addClass('fa-check');
//            }            
//        }
        
        ,loadPresetFilter: function( name ) {
            var filter = _.find(this.preset_filters,function(filter) { return filter.name == name } );
            if( filter ) {
                this.removeAllFields();
                this.loadFilter( this.persistent_filter );
                this.loadFilter( filter.fields );
            }
        }
                
        ,removeFilter: function( name ) {
            this.setSavedFilters(_.reject(this.saved_filters,function(filter) { return filter.name == name } ));
        } 
        
        ,getFieldSpec: function( field ) {
            
            if( _.isUndefined(this.fields_specs[field]) )
                return undefined;
            else
                return $.extend({},
                    {
                        label: '',
                        operators: ['=','~','<','>'],
                        wrapper_class: 'col-sm-9',
                        icon_class: '',
                        multiple: true,
                        removable: true
                    },
                    this.fields_specs[field]
                );
        }
        
        ,addField: function( field, op, value ) {
            
            var field_spec = this.getFieldSpec( field );
            
            if(_.isUndefined(field_spec))
                return;
            
            if( !field_spec.multiple ) {
                
                // multi instances not allowed
                if( this.root.find('.filter-element[data-field="' + field + '"]').length > 0 ) {
                    return;
                } 
                
                this.root.find('ul.dfw-field-list > li > a[data-field="' + field + '"]').hide();
            }
            
            var field_name = "df[f][][f]";
            var value_name = "df[f][][v]";
            var op_name    = "df[f][][o]";
            
            var id = _.uniqueId(field);

            var op_list_markup = _.map(field_spec.operators, function( op ) {
                return '<li><a data-op="' + op + '">' +  op + '</a></li>'
            }).join('');

            if( _.isUndefined(op) )
                op = field_spec.operators[0];

            if( _.isUndefined(value) )
                value = "";

            var tabindex = this.root.find(".filter-element").length + 2;
            
            var field_markup = ''+
                '<div data-field="' + field + '" class="filter-element ' + field_spec.wrapper_class + ' pull-left">'+
                    '<input class="dfw-field-name-value" type="hidden" name="' + field_name + '" value="' + field + '">' +
                        '<div class="input-group">' +
                            '<div class="input-group-addon">' +
                                '<label for="' + id + '"><span class="'+ field_spec.icon_class +'"></span> ' + field_spec.label + '</label>' +
                                (
                                (field_spec.operators.length > 1) ?
                                    '<button tabindex=-1 class="btn btn-default dfw-field-op-btn dropdown-toggle" data-toggle="dropdown">' + op + '</button>' +
                                    '<ul class="dropdown-menu dfw-field-op-list">' +
                                        op_list_markup +
                                    '</ul>' +
                                    '<input class="dfw-field-op-value" type="hidden" name="' + op_name + '" value="' + op + '">'
                                :
                                    ''
                                ) +
                            '</div>' +
                            '<input class="form-control dfw-field-value" tabindex=' + tabindex + ' name="' + value_name + '" id="' + id + '">' +
                            '<a tabindex=-1 class="dfw-field-action input-group-addon" href="#" title="Remove">' +
                                '<span class="fa"></span>' +
                            '</a>' +
                        '</div>' +
                '</div>';

            var v = $(field_markup).insertBefore( this.root.find('.clearfix') );
            
            this.adjustFieldAction(v);

            if( _.isObject(field_spec.select2) && _.isFunction($.fn.select2) ) {
                var $input = v.find("input.dfw-field-value");
                $input.select2(field_spec.select2);
                $input.select2('val',value);
            } else if( _.isObject(field_spec.daterangepicker) && _.isFunction($.fn.daterangepicker) ) {
                v.find("input.dfw-field-value").daterangepicker(field_spec.daterangepicker);
                v.find("input.dfw-field-value").val(value)
            } else {
                v.find("input.dfw-field-value").val(value)
            }

            return v;
        }

        ,removeAllFields: function( event ) {
            this.root.find('.filter-element').remove();
            this.root.find('ul.dfw-field-list > li > a[data-field]').show();
        }

        ,onFieldAction: function( event ) {
            event.preventDefault();
            var wrapper_el = $(event.target).closest(".filter-element");
            var field = wrapper_el.data('field');
            var input_el = wrapper_el.find('input.form-control');
            var span_el = wrapper_el.find('a.dfw-field-action > span');
            var field_spec = this.getFieldSpec( field );

            if( span_el.data('action') == 'remove' ) {
                wrapper_el.remove();
                this.root.find('ul.dfw-field-list > li > a[data-field="' + field + '"]').show();
            } else {
                if( _.isObject(field_spec.select2) && _.isFunction($.fn.select2) ) {
                    input_el.select2('data',[]).trigger('change');
                } else {
                    input_el.val('').trigger('change');
                }
                this.adjustFieldAction(wrapper_el);
            }
            input_el.focus();
        }

        ,adjustFieldAction: function( field_wrapper_el ) {
            var field = field_wrapper_el.data('field');
            var span_el = field_wrapper_el.find('a.dfw-field-action > span');
            var input_el = field_wrapper_el.find('input.form-control');
            var field_spec = this.getFieldSpec( field );
            
            var val = input_el.val();
            
            if( _.isEmpty( val ) && field_spec.removable ) {
                span_el.removeClass('fa-times').addClass('fa-minus');
                span_el.data('action','remove');
            } else {
                span_el.removeClass('fa-minus').addClass('fa-times');
                span_el.data('action','clear');
            }
        }
        
        ,onChangeFieldOp: function( event ) {
            event.preventDefault();
            var a_el = $(event.target);
            var wrapper_el = a_el.closest(".filter-element");
            var button_el = wrapper_el.find('button.dfw-field-op-btn');
            var input_el = wrapper_el.find('input.dfw-field-op-value');
            
            button_el.text( a_el.data('op') );
            input_el.val( a_el.data('op') );
            wrapper_el.find('input.dfw-field-value').focus();
        }

        ,remove: function() {
            this.root.off('.dynamic_filter');
            this.root.removeData('dynamic_filter');
        }

        ,loadSavedFilter: function( name ) {
            var filter = _.find(this.saved_filters,function(filter) { return filter.name == name } );
            if( filter ) {
                this.removeAllFields();
                this.loadFilter( this.persistent_filter );
                this.loadFilter( filter.fields );
            }
        }

        ,setSavedFilters: function( filters ) {
            var menu_el = this.root.find('ul.dfw-save-menu');

            menu_el.find("a[data-saved]").closest('li').remove();

            var header_el = menu_el.find("li.dfw-saved");

            this.saved_filters = [];

            var markup = '';
            _.each(filters,function( filter ) {
                this.saved_filters.push( $.extend({},filter) );
                markup += '<li><a data-saved="' + filter.name + '" href="javascript: false;"><span class="fa fa-fw"></span>' + filter.name + (filter.readonly ? '' : '<span class="pull-right fa fa-trash"></span>') + '</a></li>';
            },this);

            $(markup).insertAfter(header_el);
        }

        ,saveFilter: function( name ) {
            this.saved_filters = _.reject(this.saved_filters,function(filter) { return filter.name == name } );
            this.saved_filters.push( { name: name, fields: this.getCurrentFilter() } );
            this.setSavedFilters( this.saved_filters );
        }
        
        ,getCurrentFilter: function() {
            var fields = [];
            var self = this;
            this.root.find('.filter-element').each(function(idx, dom ) {
                var $el=$(dom);
                var field_name = $el.data('field');
                var field_spec = self.getFieldSpec( field_name );

                var $input = $el.find("input.dfw-field-value");
                var value = $input.val();

                if( _.isObject(field_spec.select2) ) {
                    value = $input.select2('val')
                }

                var field = {
                    f: field_name,
                    o: $el.find("input.dfw-field-op-value").val(),
                    v: value
                };
                fields.push( field );
            });
            return fields;            
        },
        
        getState: function() {
            return {
                filter: this.getCurrentFilter(),
                saved_filters: this.saved_filters ||[]
            } 
        },
        
        saveState: function() {
            if( this.store )
                this.store.set(this.state_id, this.getState());        
        },

        restoreState: function() {
            if( this.store )
                this.applyState(this.store.get(this.state_id));
        },

        applyState: function( state ) {
            if(_.isObject(state) && _.isObject(state.saved_filters) )
                this.setSavedFilters( state.saved_filters );
            if(_.isObject(state) && _.isObject(state.filter) )
                this.loadFilter( state.filter );
        }
    };

    $.fn.dynamicFilter = function( options ) {
        if( _.isObject(options) ) {
            this.each(function () {
                var el = $(this);

                if (el.data('dynamicFilter'))
                    el.data('dynamicFilter').remove();

                el.data('dynamicFilter', new DynamicFilter(el, $.extend({}, $.fn.dynamicFilter.defaults, options)));
            });
        } else if( _.isUndefined(options) && this.length == 1 ) {
            return $(this).data('dynamicFilter');            
        }
        return this;
    };

    $.fn.dynamicFilter.defaults = {
    };

}(jQuery, _, window, document));
