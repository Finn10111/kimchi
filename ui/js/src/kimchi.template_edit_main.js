/*
 * Project Kimchi
 *
 * Copyright IBM, Corp. 2013-2016
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *     http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */
kimchi.template_edit_main = function() {
    var templateEditMain = $('#edit-template-tabs');
    var origDisks;
    var origNetworks;
    var templateDiskSize;
    $('#template-name', templateEditMain).val(kimchi.selectedTemplate);
    $('#edit-template-tabs a[data-toggle="tab"]').on('shown.bs.tab', function (e) {
        $('.tab-content').css('overflow','hidden');
        var target = $(this).attr('href');
        $(target).css('left','-'+$(window).width()+'px');
        var left = $(target).offset().left;
        $(target).css({
                left: left
            }).animate({
                    "left": "0px"
            },400, function() {
            $('.tab-content').css('overflow','visible');
        });
    });

    var initTemplate = function(template) {
        origDisks = template.disks;
        origNetworks = template.networks;
        for(var i=0;i<template.disks.length;i++){
            if(template.disks[i].base){
                template["vm-image"] = template.disks[i].base;
                $('.templ-edit-cdrom').addClass('hide');
                $('.templ-edit-vm-image').removeClass('hide');
                break;
            }
        }
        for ( var prop in template) {
            var value = template[prop];
            if (prop == 'graphics') {
               value = value["type"];
            }
            $('input[name="' + prop + '"]', templateEditMain).val(value);
        }

        $('#template-edit-graphics').append('<option value="vnc" selected="selected">VNC</option>');
        var enableSpice = function() {
            if (kimchi.capabilities == undefined) {
                setTimeout(enableSpice, 2000);
                return;
            }
            if (kimchi.capabilities.qemu_spice == true) {
                $('#template-edit-graphics').append('<option value="spice">Spice</option>');
            }
        };
        var isImageBasedTemplate = function() {
            if (template["vm-image"] && typeof template["vm-image"] == "string") {
                return true;
            }
            return false;
        }
        enableSpice();
        $('#template-edit-graphics').selectpicker();

        var initStorage = function(result) {
            // Gather storagepools data
            var storagePoolsInfo = new Object();
            $.each(result, function(index, pool) {
               if (pool.state === 'active' && pool.type != 'kimchi-iso') {
                    if (pool.type === 'iscsi' || pool.type === 'scsi') {
                        volumes = new Object();
                        kimchi.listStorageVolumes(pool.name, function(vols) {
                            $.each(vols, function(i, vol) {
                                storagePoolsInfo[pool.name + "/" + vol.name] = {
                                    'type' : pool.type,
                                    'volSize': vol.capacity / Math.pow(1024, 3)};
                            });
                        }, null, true);
                    } else {
                        storagePoolsInfo[pool.name] = { 'type' : pool.type };
                    }
                }
            });

            var addStorageItem = function(storageData) {
                var thisName = storageData.storageName;
                // Compatibility with old versions
                if (storageData.storageVolume) {
                    storageData.storageDisk = storagePoolsInfo[thisName].volSize;
                }
                if (!storageData.storageType) {
                    storageData.storageType = storagePoolsInfo[thisName].type;
                }

                var nodeStorage = $.parseHTML(wok.substitute($('#template-storage-pool-tmpl').html(), storageData));
                $('.template-tab-body', '#form-template-storage').append(nodeStorage);
                var storageRow = '#storageRow' + storageData.storageIndex;

                var storageOptions = '';
                $.each(storagePoolsInfo, function(poolName, value) {
                    storageOptions += '<option value="' + poolName + '">' + poolName + '</option>';
                });

                $(storageRow + ' #selectStorageName').append(storageOptions);
                $(storageRow + ' #selectStorageName').val(storageData.storageName);
                $(storageRow + ' #selectStorageName').selectpicker();

                if (storageData.storageType === 'iscsi' || storageData.storageType  === 'scsi') {
                    $(storageRow + ' .template-storage-disk').attr('readonly', true).prop('disabled', true);
                    $(storageRow + ' #diskFormat').val('raw');
                    $(storageRow + ' #diskFormat').prop('disabled', true).change();
                } else if (storageData.storageType === 'logical') {
                    $(storageRow + ' #diskFormat').val('raw');
                    $(storageRow + ' #diskFormat').prop('disabled', true).change();
                }

                // Set disk format
                if (isImageBasedTemplate()) {
                    $(storageRow + ' #diskFormat').val('qcow2');
                    $(storageRow + ' #diskFormat').prop('disabled', 'disabled');
                }
                else {
                    $(storageRow + ' #diskFormat').val(storageData.storageDiskFormat);
                    $(storageRow + ' #diskFormat').on('change', function() {
                        $(storageRow + ' .template-storage-disk-format').val($(this).val());
                    });
                }
                $(storageRow + ' #diskFormat').selectpicker();

                $('.delete', '#form-template-storage').on( "click",function(event) {
                    event.preventDefault();
                    $(this).parent().parent().remove();
                });

                $(storageRow + ' #selectStorageName').change(function() {
                    var poolType = storagePoolsInfo[$(this).val()].type;
                    $(storageRow + ' .template-storage-name').val($(this).val());
                    $(storageRow + ' .template-storage-type').val(poolType);
                    if (poolType === 'iscsi' || poolType === 'scsi') {
                        $(storageRow + ' .template-storage-disk').attr('readonly', true).prop('disabled', true).val(storagePoolsInfo[$(this).val()].volSize);
                        if (!isImageBasedTemplate()) {
                            $(storageRow + ' #diskFormat').val('raw').prop('disabled', true).change();
                        }
                    } else if (poolType === 'logical') {
                        $(storageRow + ' .template-storage-disk').attr('readonly', false).prop('disabled', false);
                        if (!isImageBasedTemplate()) {
                            $(storageRow + ' #diskFormat').val('raw').prop('disabled', true).change();
                        }
                    } else {
                        $(storageRow + ' .template-storage-disk').attr('readonly', false).prop('disabled', false);
                        if ($(storageRow + ' #diskFormat').prop('disabled') == true && !isImageBasedTemplate()) {
                            $(storageRow + ' #diskFormat').val('qcow2').prop('disabled', false).change();
                        }
                    }
                    $(storageRow + ' #diskFormat').selectpicker('refresh');
                });
            };  // End of addStorageItem funtion

            if (origDisks && origDisks.length) {
                origDisks.sort(function(a, b){return a.index-b.index});
                $.each(origDisks, function(index, diskEntities) {
                    var defaultPool = diskEntities.pool.name.split('/').pop()
                    var storageNodeData = {
                        storageIndex : diskEntities.index,
                        storageName : diskEntities.volume ? defaultPool + '/' + diskEntities.volume : defaultPool,
                        storageType : diskEntities.pool.type,
                        storageDisk : diskEntities.size,
                        storageDiskFormat : diskEntities.format ? diskEntities.format : 'qcow2',
                        storageVolume : diskEntities.volume
                    }
                    addStorageItem(storageNodeData);
                });
            }

            var storageID = origDisks.length -1;
            $('#template-edit-storage-add-button').on("click", function(event) {
                event.preventDefault();
                storageID = storageID + 1;
                var storageNodeData = {
                    storageName : 'default',
                    storageType : 'dir',
                    storageDisk : '10',
                    storageDiskFormat : 'qcow2',
                    storageIndex : storageID
                }
                addStorageItem(storageNodeData);
            });
        };

        var initInterface = function(result) {
            var networkItemNum = 0;
            var addInterfaceItem = function(networkData) {
                var networkName = networkData.networkV;
                var nodeInterface = $.parseHTML(wok.substitute($('#template-interface-tmpl').html(), networkData));
                $('.template-tab-body', '#form-template-interface').append(nodeInterface);
                $('.delete', '#form-template-interface').on( "click",function(event) {
                    event.preventDefault();
                    $(this).parent().parent().remove();
                });
                var networkOptions = '';
                for(var i=0;i<result.length;i++){
                    if(result[i].state === "active") {
                        var isSlected = networkName===result[i].name ? ' selected' : '';
                        networkOptions += '<option' + isSlected + '>' + result[i].name + '</option>';
                    }
                }
                $('select', '#form-template-interface #networkID' + networkItemNum).append(networkOptions);
                $('select', '#form-template-interface #networkID' + networkItemNum).selectpicker();
                networkItemNum += 1;
            };
            if(result && result.length > 0) {
                for(var i=0;i<origNetworks.length;i++) {
                    addInterfaceItem({
                        networkID : 'networkID' + networkItemNum,
                        networkV : origNetworks[i],
                        type : 'network'
                    });
                }
            }
            $('#template-edit-interface-add-button').on( "click", function(event) {
                event.preventDefault();
                addInterfaceItem({
                    networkID : 'networkID' + networkItemNum,
                    networkV : 'default',
                    type : 'network'
                });
            });
        };

        var initProcessor = function(){
            var setCPUValue = function(){
                if(!$('#cores').hasClass("invalid-field")&&$('#cores').val()!=""){
                    $("#vcpus").val(parseInt($("#cores").val())*parseInt($("#threads").val()));
                }else{
                    $("#vcpus").val('');
                }
            };
            $("input:text", "#form-template-processor").on('keyup', function(){
                $(this).toggleClass("invalid-field", !$(this).val().match('^[0-9]*$'));
                if($(this).prop('id')=='cores') setCPUValue();
            });
            $("input:checkbox", "#form-template-processor").click(function(){
                $(".topology", "#form-template-processor").toggleClass("hide", !$(this).prop("checked"));
                $("#vcpus").attr("disabled", $(this).prop("checked"));
                setCPUValue();
            });
            $('select', '#form-template-processor').change(function(){
                setCPUValue();
            });
            kimchi.getCPUInfo(function(data){
                var options = "";
                for(var i=0;Math.pow(2,i)<=data.threads_per_core;i++){
                    var lastOne = Math.pow(2,i+1)>data.threads_per_core?" selected":"";
                    options += "<option"+lastOne+">"+Math.pow(2,i)+"</option>";
                }
                $('select', '#form-template-processor').append(options);
                $('select', '#form-template-processor').selectpicker();
                if(template.cpu_info.vcpus) $("#vcpus").val(template.cpu_info.vcpus);
                var topo = template.cpu_info.topology;
                if(topo&&topo.cores) $("#cores").val(topo.cores);
                if(topo&&topo.threads){
                    $('select', '#form-template-processor').val(topo.threads);
                    $("input:checkbox", "#form-template-processor").trigger('click');
                }
            });
        };
        kimchi.listNetworks(initInterface);
        kimchi.listStoragePools(initStorage);
        initProcessor();
    };
    kimchi.retrieveTemplate(kimchi.selectedTemplate, initTemplate);

    $('#tmpl-edit-button-save').on('click', function() {
        $button = $(this);
        $button.html('<span class="wok-loading-icon" /> '+i18n['KCHAPI6010M']);
        $('.modal input[type="text"]').prop('disabled', true);
        $('.modal input[type="checkbox"]').prop('disabled', true);
        $('.modal select').prop('disabled', true);
        $('.modal .selectpicker').addClass('disabled');
        var editableFields = [ 'name', 'memory', 'graphics'];
        var data = {};
        var disks = $('.template-tab-body .item', '#form-template-storage');
        var disksForUpdate = new Array();
        $.each(disks, function(index, diskEntity) {
            var newDisk = {
                'index' : index,
                'pool' : {'name': '/plugins/kimchi/storagepools/' + $(diskEntity).find('.template-storage-name').val()},
                'size' : Number($(diskEntity).find('.template-storage-disk').val()),
                'format' : $(diskEntity).find('.template-storage-disk-format').val()
            };

            var storageType = $(diskEntity).find('.template-storage-type').val();
            if(storageType === 'iscsi' || storageType === 'scsi') {
                newDisk['volume'] = newDisk['pool']['name'].split('/').pop();
                newDisk['pool']['name'] =  newDisk['pool']['name'].slice(0,  newDisk['pool']['name'].lastIndexOf('/'));
                delete newDisk.size;
            }
            disksForUpdate.push(newDisk);
        });
        data.disks = disksForUpdate;

        $.each(editableFields, function(i, field) {
            if (field == 'graphics') {
               var type = $('#form-template-general [name="' + field + '"]').val();
               data[field] = {'type': type};
            }
            else {
               data[field] = $('#form-template-general [name="' + field + '"]').val();
            }
        });
        data['memory'] = Number(data['memory']);
        if($("input:checkbox", "#form-template-processor").prop("checked")){
            data['cpu_info'] = {
                vcpus: parseInt($('#vcpus').val()),
                maxvcpus: parseInt($('#vcpus').val()),
                topology: {
                    sockets: 1,
                    cores: parseInt($("#cores").val()),
                    threads: parseInt($("#threads").val())
                }
            };
        }else{
            data['cpu_info'] = {
                vcpus: parseInt($('#vcpus').val())
            };
        }
        var networks = $('.template-tab-body .item', '#form-template-interface');
        var networkForUpdate = new Array();
        $.each(networks, function(index, networkEntities) {
            var thisValue = $('select', networkEntities).val();
            networkForUpdate.push(thisValue);
        });
        if (networkForUpdate instanceof Array) {
            data.networks = networkForUpdate;
        } else if (networkForUpdate != null) {
            data.networks = [networkForUpdate];
        } else {
            data.networks = [];
        }

        kimchi.updateTemplate($('#template-name').val(), data, function() {
            kimchi.doListTemplates();
            wok.window.close();
        }, function(err) {
            $button.html(i18n['KCHAPI6007M']);
            $('.modal input[type="text"]').prop('disabled', false);
            $('.modal input[type="checkbox"]').prop('disabled', false);
            $('.modal select').prop('disabled', false);
            $('.modal .selectpicker').removeClass('disabled');
            wok.message.error(err.responseJSON.reason,'#alert-modal-container');
        });
    });
};
