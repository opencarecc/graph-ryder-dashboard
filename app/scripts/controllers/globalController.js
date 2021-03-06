/**
 * Created by nferon on 17/06/16.
 */
'use strict';
/**
 * @ngdoc function
 * @name sbAdminApp.controller:GlobalCtrl
 * @description
 * # GlobalCtrl
 * Controller of the sbAdminApp
 */
angular.module('sbAdminApp')
    .controller('GlobalCtrl', function ($scope, $resource, config, $uibModal, $rootScope, $q, $location, $timeout) {

        /**** Init ****/
        //edge label default
        $scope.globalel = false;
        $scope.locate = "";
        // When rootScope is ready load the graph
        $rootScope.$watch('ready', function(newVal) {
            if(newVal) {
                $scope.layoutChoice = $rootScope.layout[12];
                $scope.drawGraph();
                refreshPostType();
            }
        });

        /***** Global view *****/
        $scope.globalGraphSigma = [];

        $scope.drawGraph = function () {
            // // Read the complete graph from api
            var drawGraph = $resource(config.apiUrl + 'draw/complete/' + $scope.layoutChoice);
            $scope.drawGraphPromise = drawGraph.get();
            $scope.drawGraphPromise.$promise.then(function (result) {
                $scope.globalGraphSigma = result;
            });
        };

        /*** TimeLine ****/
        $scope.time_data = [];
        $scope.selected = {};
        var timeLinePromises = [];

        // Create promises array to wait all data until load
        timeLinePromises.push($resource(config.apiUrl + 'users/count/timestamp').query().$promise);
        timeLinePromises.push($resource(config.apiUrl + 'posts/count/timestamp').query().$promise);
        timeLinePromises.push($resource(config.apiUrl + 'comments/count/timestamp').query().$promise);

        $q.all(timeLinePromises).then(function(results) {
            var tmp = {"users": [], "posts": [], "comments": []};
            // Users
            angular.forEach(results[0], function(result) {
                tmp.users.push(result);
            });
            // Posts
            angular.forEach(results[1], function(result) {
                tmp.posts.push(result);
            });
            // Comments
            angular.forEach(results[2], function (result) {
                tmp.comments.push(result);
            });
            // append data
            $scope.time_data = tmp;
        }, function (reject) {
            console.log(reject);
        });

        // Time selection have been made on the chart
        $scope.extent = function (start, end) {
            if(!start && !end) //release signal
                refreshPostType();
            else {
                $scope.selected.start = start;
                $scope.selected.end = end;
                // Update sigma filter
                $scope.filter = {"start": start.getTime(), "end": end.getTime()};
                $scope.$apply();
            }
        };

        /*** Radar Chart ***/
        var all = {name: "all"};
        var postSelection = [all];

        // Call api and load postType
        var refreshPostType = function () {
            $scope.postType = {};
            $scope.postType.series = [];
            $scope.postType.labels = [];

            var params = {"users": []};

            angular.forEach(postSelection, function(selection) {
                if(selection != all) {
                    params.uid.push(selection.id);
                    $scope.postType.series.push(selection.name);
                }
            });

            if($scope.selected.start != undefined)
                params.start = $scope.selected.start.getTime();
            if($scope.selected.end != undefined)
                params.end = $scope.selected.end.getTime();

            var Type = $resource(config.apiUrl + 'post/getType/', params);
            var type = Type.get();
            type.$promise.then(function (result) {
                $scope.postType.labels = result.labels;
                if(postSelection.indexOf(all) != -1) {
                    $scope.postType.data = result.data;
                    $scope.postType.series.push("all");
                }
                else {
                    result.data.shift();
                    $scope.postType.data = result.data;
                }
            });
        };

        var postTypeAddUser = function (uid, name, append) {
            if(append)
                postSelection.push({id: uid, name: name});
            else
                postSelection = [{id: uid, name: name}];
            refreshPostType();
        };

        /*** Sigma Event Catcher ***/
        $scope.eventCatcher = function (e) {
            switch(e.type) {
                case 'clickNode':
                    console.log(e.data.captor);
                    if(e.data.node.uid != undefined && e.data.captor.altKey) {
                        postTypeAddUser(e.data.node.uid, e.data.node.name, e.data.captor.shiftKey);
                    }
                    else {
                        if(e.data.node.user_id != undefined) {
                            $scope.elementType = "user";
                            $scope.elementId = e.data.node.user_id
                        }
                        else if (e.data.node.post_id != undefined) {
                            $scope.elementType = "post";
                            $scope.elementId = e.data.node.post_id;
                        }
                        else if (e.data.node.comment_id != undefined) {
                            $scope.elementType = "comment";
                            $scope.elementId = e.data.node.comment_id;
                        }
                        else if (e.data.node.tag_id != undefined) {
                            $scope.elementType = "tag";
                            $scope.elementId = e.data.node.tag_id;
                        }
                        else if (e.data.node.annotation_id != undefined) {
                            $scope.elementType = "annotation";
                            $scope.elementId = e.data.node.annotation_id;
                        }
                        else {
                            console.log("Unexpected node: "+e.data.node);
                        }
                        $scope.openModal($scope.elementType, $scope.elementId);
                    }
                    break;
            }
        };

        /********* Modal  ***************/
        $scope.openModal = function (type, id) {
            $scope.elementType = type;
            $scope.elementId = id;

            var modalInstance = $uibModal.open({
                animation: true,
                templateUrl: 'views/ui-elements/modal-view.html',
                controller: 'ModalInstanceCtrl',
                buttons: {
                    Cancel: function () {
                        $("#modal_dialog").dialog("close");
                    }
                },
                resolve: {
                    scopeParent: function() {
                        return $scope; //On passe à la fenêtre modal une référence vers le scope parent.
                    }
                }
            });

            // Catch return, reopen a new modal ?
            modalInstance.result.then(function (res) {
                if(res != undefined) {
                    res = res.split(':');
                    $scope.openModal(res[0], res[1]);
                }
            });
        };

        /*** Search Bar Catcher *****/
        $rootScope.$watch('search', function(newVal) {
            var locateTmp = [];
            if(newVal != undefined) {
                if( newVal.uid != undefined) {
                    locateTmp.push(newVal.uid);
                    postTypeAddUser(newVal.uid, newVal.name, false);
                }
                else if( newVal.pid != undefined) {
                    locateTmp.push(newVal.pid);
                }
                else if( newVal.cid != undefined) {
                    locateTmp.push(newVal.cid);
                }
                if (!$scope.drawGraphPromise.$resolved) // todo do not wait but cancel the promise
                    $timeout(function() {$scope.locate = locateTmp;}, 5000);
                else
                    $scope.locate = locateTmp;
            }
        });
        $scope.$on("$destroy", function(){
            //todo stop all active request
            // remove watchers in rootScope
            angular.forEach($rootScope.$$watchers, function(watcher, key) {
                if(watcher.exp === 'search' || watcher.exp === 'ready') {
                    $rootScope.$$watchers.splice(key, 1);
                }
            });
        });
    });
