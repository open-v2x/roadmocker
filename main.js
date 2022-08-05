let connectionForm,
    subscriptionForm,
    publishForm,
    state,
    messageList,
    colorPicker,
    datasetForm,
    sendMessageList,
    heartbeatInterval,
    tableData = [], // 列表项
    checkedData = [], // 所有已勾选的 json 数据
    rsmInterval = [];
    loadingData = new Set(); // 加载列表

let client, protol, host, data_set_server;
const TOPIC_COLOR_MAP = {};
const SUBSCRIBED_TOPICS = [];

const topicReplace = (topic, delimiter = "/") => {
    return topic.replace(new RegExp("\\.",("gm")), delimiter);
}

// Msg_VIR：车辆意图和请求（Message: Vehicle Intention And Request）
const dataSetConfig = (esn = "", delimiter = "/") => {
    return [
        {name: "RSU_INFO", topic: topicReplace(`V2X.RSU.INFO.UP`, delimiter), description: "上报RSU信息"},
        {name: "RSU_MAP", topic: topicReplace(`V2X.RSU.${esn}.MAP.UP`, delimiter), description: "上报MAP信息"},
        {name: "RSI_data", topic: topicReplace(`V2X.RSU.${esn}.RSI.UP.DAWNLINE`, delimiter), description: "RSI上报数据"},
        {name: "video_track", topic: topicReplace(`V2X.RSU.${esn}.RSM.UP.DAWNLINE`, delimiter), description: "视频检测数据"},
        {name: "radar_track", topic: topicReplace(`V2X.RSU.${esn}.RSM.UP.DAWNLINE`, delimiter), description: "毫米波雷达检测数据"},
        {name: "multi_source_fusion_track", topic: topicReplace(`V2X.RSU.${esn}.RSM.UP.DAWNLINE`, delimiter), description: "雷视融合算法，测试轨迹数据"},
        {name: "ICW_track", topic: topicReplace(`V2X.RSU.${esn}.RSM.UP`, delimiter), description: "交叉口车辆间碰撞预警场景，轨迹数据"},
        {name: "VPTC_CW_track_stright", topic: topicReplace(`V2X.RSU.${esn}.RSM.UP.DAWNLINE`, delimiter), description: "弱势交通参与者碰撞预警场景，车辆直行"},
        {name: "VPTC_CW_track_turn", topic: topicReplace(`V2X.RSU.${esn}.RSM.UP.DAWNLINE`, delimiter), description: "弱势交通参与者碰撞预警场景，车辆转向"},
        {name: "CLC_track", topic: topicReplace(`V2X.RSU.${esn}.RSM.UP.DAWNLINE`, delimiter), description: "协作换道场景，轨迹数据"},
        {name: "msg_VIR_CLC", topic: topicReplace(`V2X.RSU.${esn}.VIR.UP`, delimiter), description: "协作换道场景，车辆请求信息"},
        {name: "DNP_track", topic: topicReplace(`V2X.RSU.${esn}.RSM.UP.DAWNLINE`, delimiter), description: "逆向超车场景，轨迹数据"},
        {name: "msg_VIR_DNP", topic: topicReplace(`V2X.RSU.${esn}.VIR.UP`, delimiter), description: "逆向超车场景，车辆请求信息"},
        {name: "SDS_track", topic: topicReplace(`V2X.RSU.${esn}.RSM.UP.DAWNLINE`, delimiter), description: "数据共享场景，轨迹数据"},
        {name: "msg_VIR_SDS", topic: topicReplace(`V2X.RSU.${esn}.VIR.UP`, delimiter), description: "数据共享场景，车辆请求信息"},
    ];
};

$(function () {
    host = window.location.hostname;
    // data_set_server = window.location.href + 'test-data'
    data_set_server = "http://47.100.126.13:6688/test-data"
    $("#host").val(host);

    colorPicker = $("#color");
    colorPicker.colorpicker();
    $("#connectButton").click(toggleConnect);
    $("#subscribeButton").click(handleSubscribe);
    $("#publishButton").click(handlePublish);
    $("#topicList").click(handleUnsubscribe);
    $("#clearMessage").click(clearMessage);
    $("#publishDataSetButton").click(handlePublishDataset);
    $("#subscribeSettingButton").click(handleSubscribeSettingButton);
    $("#startHeartbeatButton").click(handleStartHeartbeat);
    $("#pauseHeartbeatButton").click(handlePauseHeartbeat);
    $("#clearHeartbeatButton").click(handleClearHeartbeat);
    $("#clearSendMessage").click(clearSendMessage);
    $("#download").click(handleDownload);

    // if (window.location.protocol === 'https:') {
    //   protol = 'wss';
    //   $('#port').val(443);
    // } else {
    //   protol = 'ws';
    //   $('#port').val(80);
    // }

    $("#clientId").val("RSU-" + (((1 + Math.random()) * 0x10000000) | 0).toString(16));
    initTable();
});

function initTable() {
    tableData = dataSetConfig();

    $("#tb_dataset").bootstrapTable({
        data: tableData,
        pagination: false,
        columns: [
            {
                checkbox: true
            },
            {
                field: "name",
                title: "DataSet Name"
            },
            {
                field: "description",
                title: "Description",
                formatter: function (value, row, index) {
                    return value || "";
                }
            },
            {
                field: "Button",
                title: "Action",
                align: "center",
                formatter: function (value, row, index) {
                    const {name} = row;

                    var result = `<a href="${data_set_server}/${name}.json" target="blank">
                          <button id="preview-${name}" type="button" class="btn btn-primary">Preview</button>
                      </a>`;
                    result += `<button type="button" id="loading-${name}" class="btn btn-primary loading-hidden" disabled>Loading</button>`
                    result += `<button type="button" id="stop-${name}" class="btn btn-danger stop stop-hidden" onclick="stopPublish('${name}')">Stop</button>`;

                    return result;
                }
            }
        ],
        onCheck: function (row, $element) {
            getCheckedRowData(row);
        },
        onUncheck: function (row, $element) {
            checkedData = checkedData.filter((it) => it.name !== row.name);
        },
        onCheckAll: function(rows, $element) {
            rows.forEach(row => {
                getCheckedRowData(row);
            })
        },
        onUncheckAll: function () {
            checkedData = [];
        }
    });
}

function stopPublish(name) {
    for (let i = 0; i < rsmInterval.length; i++) {
        if (rsmInterval[i].name === name) {
            clearInterval(rsmInterval[i].interval);
            rsmInterval.splice(i, 1);

            $("#stop-" + name).removeClass("stop-show");
        }
    }
}

function loadingAni(name) {
    loadingData.add(name);
    $("#loading-" + name).removeClass("loading-hidden")
    $("#preview-" + name).addClass("preview-hidden")
}

function loadedAni(name) {
    loadingData.delete(name)
    $("#loading-" + name).addClass("loading-hidden")
    $("#preview-" + name).removeClass("preview-hidden")
}

function getCheckedRowData(row) {
    const {name} = row;
    loadingAni(name)
    $.ajax({
        url: `${data_set_server}/${name}.json`,
        type: "GET",
        success: function (res) {
            checkedData.push({name, data: res});
            loadedAni(name)
        }
    });
}

function toggleConnect(event) {
    if (client) {
        client.end(true, function () {
            state.attr("class", "color-red");
            state.children("span").text("disconnected");
            $(event.target).text("Connect");
            $("#topicList").empty();
            SUBSCRIBED_TOPICS.length = 0;
            client = null;
        });
    } else {
        connectionForm = connectionForm || $("#connectionForm");
        const formData = convertFormData(connectionForm.serializeArray());

        client = mqtt.connect(`${protol}://${formData.host}:${formData.port}${formData.path || ""}`, {
            username: formData.username,
            password: formData.password,
            clientId: formData.clientId,
            keepalive: formData.keepalive && parseInt(formData.keepalive)
        });

        client.on("connect", function () {
            state = state || $("#state");
            state.attr("class", "color-green");
            state.children("span").text("connected");
            $(event.target).text("Disconnect");
        });

        client.on("error", function (err) {
            alert("There has some problems when create connection!\n Error is:" + err.message);
        });

        client.on("message", handleMessage);
    }
    return false;
}

function handleHeartbeat(data) {
    const seqNum = 0;
    data = {...data, seqNum, timestamp: new Date().getTime()};
    const heartbeatTime = $("#heartbeatInput").val();

    const topic = "V2X/RSU/HB/UP";
    const msg = JSON.stringify(data);
    const qos = 0;
    const retain = "off";
    if (client) {
        setTimeout(() => {
            client.publish(topic, msg, {
                qos: parseInt(qos),
                retain: retain === "on"
            });
            addHeartbeatMessage2List("发送成功", true);
        }, 200);
        heartbeatInterval = setInterval(() => {
            data.seqNum = data.seqNum + 1;
            client.publish(topic, msg, {
                qos: parseInt(qos),
                retain: retain === "on"
            });
            addHeartbeatMessage2List("发送成功", true);
        }, heartbeatTime * 1000);
    } else {
        alert("You have to create connection first!");
    }
    event.preventDefault();
}

function handleRsuOptions(topic, msg, packet) {
    const result = JSON.parse(msg.toString()) || msg.toString();
    $("#bsmSampleMode").val(result.bsmConfig.sampleMode);
    $("#bsmSampleRate").val(`${result.bsmConfig.sampleRate / 100}%`);
    $("#bsmUpLimit").val(result.bsmConfig.upLimit === -1 ? "不限" : result.bsmConfig.upLimit);
    $("#bsmFilters").val(JSON.stringify(result.bsmConfig.upFilters));

    $("#rsiFilters").val(JSON.stringify(result.rsiConfig.upFilters));

    $("#rsmUpLimit").val(result.rsmConfig.upLimit === -1 ? "不限" : result.rsmConfig.upLimit);
    $("#rsmFilters").val(JSON.stringify(result.rsmConfig.upFilters));

    $("#mapUpLimit").val(result.mapConfig.upLimit === -1 ? "不限" : result.mapConfig.upLimit);
    $("#mapFilters").val(JSON.stringify(result.mapConfig.upFilters));

    $("#spatUpLimit").val(result.spatConfig.upLimit === -1 ? "不限" : result.spatConfig.upLimit);
    $("#spatFilters").val(JSON.stringify(result.spatConfig.upFilters));
}

function handleSubscribe(event) {
    subscriptionForm = subscriptionForm || $("#subscriptionForm");
    const formData = convertFormData(subscriptionForm.serializeArray());

    const {subscribeTopic: topic, subscribeQoS: qos, color} = formData;

    if (client) {
        if (SUBSCRIBED_TOPICS.includes(topic)) {
            alert("You are already subscribed to this topic!");
            return false;
        }
        SUBSCRIBED_TOPICS.push(topic);
        client.subscribe(topic, {qos: parseInt(qos)}, function (err) {
            if (err) {
                alert(`There has some problems when subscribe topic "${formData.topic}"!\nError:${err.message}`);
            } else {
                TOPIC_COLOR_MAP[topic] = color;
                $("#topicList").append(
                    `<li class='topic-item' style='border-left-color: ${color}'>
             <div class='content'>
               <a class='close' data-topic='${topic}'>x</a>
               <div class='qos'>Qos:${qos}</div>
               <div class='topic'>${topic}</div>
             </div>
           </li>`
                );
                colorPicker.colorpicker("setValue", getRandomColor());
            }
        });
    } else {
        alert("You have to create connection first!");
    }

    event.preventDefault();
}

function handleUnsubscribe(event) {
    const target = event.target;
    if (target.tagName === "A") {
        const $target = $(target);
        const topic = $target.data("topic");
        client.unsubscribe(topic, function (err) {
            if (err) {
                alert(`Unsubscribe topic: ${topic} fail!`);
            } else {
                SUBSCRIBED_TOPICS.splice(SUBSCRIBED_TOPICS.indexOf(topic), 1);
                $target.parents("li").remove();
            }
        });
        return false;
    }
}

function handlePublish() {
    publishForm = publishForm || $("#publishForm");
    const formData = convertFormData(publishForm.serializeArray());

    const {publishTopic: topic, publishQoS: qos, publishRetain: retain, publishMessage: msg} = formData;

    if (client) {
        client.publish(topic, msg, {
            qos: parseInt(qos),
            retain: retain === "on"
        });
    } else {
        alert("You have to create connection first!");
    }
    event.preventDefault();
}

const cooperMap = {
    CLC_track: "msg_VIR_CLC",
    DNP_track: "msg_VIR_DNP",
    SDS_track: "msg_VIR_SDS"
};

/* publish 数据集 */
function handlePublishDataset() {
    if (checkedData.length === 0) {
        alert("You have to check a dataset first!");
        event.preventDefault();
        return;
    }
    if (!client) {
        alert("You have to create connection first!");
        return;
    }

    const [newCheckedData, virData] = postCheckedData(checkedData);

    for (let i = 0; i <= newCheckedData.length - 1; i++) {
        const {name, data} = newCheckedData[i];

        // 是否启动定时器发送该类型数据，0.5 秒发一条，否则直接发
        if (isIntervalData(name)) {
            const isExist = rsmInterval.find((it) => it.name === name) ? true : false;
            // 如果当前类型数据是否正在发送，如果不存在，则创建定时器
            if (isExist) {
                continue;
            }

            let i = 0;
            const interval = setInterval(function () {
                const msg = JSON.stringify(data[i]);

                if (!client) {
                    clearInterval(interval);
                    return;
                }

                publish(name, msg);
                syncPublish(data[i], virData, name);

                i = i + 1;
                // 超出 data 范围，清除定时器[]
                if (i > data.length) {
                    clearInterval(interval);
                    rsmInterval = rsmInterval.filter((item) => item.name !== name);
                }
            }, 100);
            rsmInterval.push({name, interval});
            addStopButton(name);
        } else {
            publish(name, JSON.stringify(data));
        }
    }

    /**
     * rsm 数据和 msg_VIR 数据按时间戳相同一起发
     * time_msg = msg_VIR['secMark'] ; time_RSM = RSM[0]['content'][0]['timeStamp']
     * @param {*} name
     * @param {*} msg
     */
    function publish(name, msg) {
        connectionForm = connectionForm || $("#connectionForm");
        const formData = convertFormData(connectionForm.serializeArray());
        datasetForm = datasetForm || $("#datasetForm");
        const datasetFormData = convertFormData(datasetForm.serializeArray());
        const rsu = formData.clientId;
        const delimiter = datasetFormData.topicDelimiter;

        const topic = dataSetConfig(rsu, delimiter).find((it) => it.name === name).topic;

        if (client) {
            client.publish(topic, msg, {});

            handleDataSetSendMessage(topic, msg);
        } else {
            alert("You have to create connection first!");
        }
    }

    /**
     * 同步发送的数据
     * @param {*} data
     * @param {*} virData
     */
    function syncPublish(data, virData, name) {
        const time_rsm = data?.[0]?.content?.[0]?.timeStamp;
        if (!time_rsm) return;

        const msg_vir_name = cooperMap[name];
        if (!msg_vir_name) return;

        const cooperData = virData.flat().find((item) => item.name === msg_vir_name);

        if (time_rsm && msg_vir_name && cooperData) {
            const sameTimeData = cooperData?.data?.find((item) => time_rsm === item.timeStamp);
            if (sameTimeData) {
                const msg_vir = JSON.stringify(sameTimeData);
                console.log(`timeStamp:${time_rsm}-----msg_VIR data:${msg_vir}`);
                publish(msg_vir_name, msg_vir);
            }
        }
    }

    function addStopButton(name) {
        $(`#stop-${name}`).addClass("stop-show");
    }

    event.preventDefault();
}

function handleMessage(topic, msg, packet) {
    console.log('收到的数据', topic, msg.toString(), packet);
    if (topic.includes("/CONFIG/DOWN")) {
        handleRsuOptions(topic, msg, packet);
    }
    messageList = messageList || $("#messageList");
    messageList.prepend(`<li style="border-left: solid 10px ${getColorForSubscription(topic)};">
                <div class="container-fluid message">
                  <div class="row small-text">
                    <div class="col-md-3">${new Date().toLocaleString()}</div>
                    <div class="col-md-5">Topic: ${topic}</div>
                    <div class="col-md-2">Qos: ${packet.qos}</div>
                    <div class="col-md-2">Retain: ${packet.retain}</div>
                  </div>
                  <div class="row">
                    <div class="col-md-12 message-content">
                      ${msg}
                    </div>
                  </div>
                </div>
              </li>`);
}

function handleDataSetSendMessage(topic, msg) {
    const idName = getRandomIdName();
    sendMessageList = sendMessageList || $("#sendMessageList");
    const sendTime = new Date().toLocaleString();
    sendMessageList.prepend(`<li style="border-left: solid 10px ${getColorForSubscription(topic)};">
                  <div class="container-fluid message">
                    <a href="#${idName}" aria-controls="${idName}" data-toggle="modal" data-target="#exampleModal">
                      <div class="row small-text">
                      <div class="col-md-3">${sendTime}</div>
                      <div class="col-md-5">Topic: ${topic}</div>
                      <div class="col-md-12">Msg: ${msg && msg.substring(0, 100)}.....</div>
                    </a>
                  </div>
                  <div class="modal fade" id="exampleModal" tabindex="-1" role="dialog" aria-labelledby="exampleModalLabel" aria-hidden="true">
                    <div class="modal-dialog" role="document">
                      <div class="modal-content">
                        <div class="modal-body">
                          <pre>${JSON.stringify(msg ? JSON.parse(msg) : {}, null, 4)}</pre>
                        </div>
                        <div class="modal-footer">
                          <button type="button" class="btn btn-secondary" data-dismiss="modal">Close</button>
                        </div>
                      </div>
                    </div>
                </div>
                </li>`);
}

function handleDownload() {
    if (checkedData.length === 0) {
        alert("You have to check a dataset first!");
        event.preventDefault();
        return;
    }

    // 下载 data 数据 为 json 格式
    checkedData.forEach(function (item) {
        const {name, data} = item;
        const blob = new Blob([JSON.stringify(data)], {type: "application/json"});
        const url = URL.createObjectURL(blob);
        const a = document.createElement("a");
        a.href = url;
        a.download = `${name}.json`;
        a.click();
    });

    event.preventDefault();
}

function clearMessage() {
    $("#messageList").empty();
}

function handleSubscribeSettingButton() {
    subscriptionForm = subscriptionForm || $("#subscriptionForm");
    connectionForm = connectionForm || $("#connectionForm");
    const formData = convertFormData(subscriptionForm.serializeArray());
    const connectFormData = convertFormData(connectionForm.serializeArray());
    const {color} = formData;
    const {clientId} = connectFormData;
    const topic = `V2X/RSU/${clientId}/CONFIG/DOWN`;

    if (client) {
        if (SUBSCRIBED_TOPICS.includes(topic)) {
            alert("You are already subscribed to this topic!");
            return false;
        }
        SUBSCRIBED_TOPICS.push(topic);
        client.subscribe(topic, {qos: 0}, function (err) {
            if (err) {
                alert(`There has some problems when subscribe topic "${topic}"!\nError:${err.message}`);
            }
            TOPIC_COLOR_MAP[topic] = color;
            $("#topicList").append(
                `<li class='topic-item' style='border-left-color: ${color}'>
             <div class='content'>
               <a class='close' data-topic='${topic}'>x</a>
               <div class='qos'>Qos:0</div>
               <div class='topic'>${topic}</div>
             </div>
           </li>`
            );
            colorPicker.colorpicker("setValue", getRandomColor());
        });
    } else {
        alert("You have to create connection first!");
    }

    event.preventDefault();
}

function handleStartHeartbeat() {
    clearInterval(heartbeatInterval);
    heartbeatInterval = null;
    if (client) {
        connectionForm = connectionForm || $("#connectionForm");
        const formData = convertFormData(connectionForm.serializeArray());
        const clientId = formData.clientId;

        const heartbeatData = {
            rsuId: clientId,
            rsuEsn: clientId,
            rsuName: clientId,
            rsuStatus: true,
            protocolVersion: "v1",
            ack: false
        };

        handleHeartbeat(heartbeatData);
        addHeartbeatMessage2List("开始发送心跳");
    } else {
        alert("You have to create connection first!");
    }
    event.preventDefault();
}

function handlePauseHeartbeat() {
    if (client) {
        if (heartbeatInterval) {
            clearInterval(heartbeatInterval);
            heartbeatInterval = undefined;
            addHeartbeatMessage2List("停止发放心跳");
        }
    } else {
        alert("You have to create connection first!");
    }
    event.preventDefault();
}

function addHeartbeatMessage2List(message, isAddTime = false) {
    $("#heartbeatList").prepend(`<li class='list-group-item list-container'>
      <div class='list-group-item-left'>${message}</div>
      <div class='list-group-item-right'>
        ${isAddTime ? new Date().toLocaleString() : ""}
      </div>
    </li>`);
}

function handleClearHeartbeat() {
    $("#heartbeatList").find("li").remove();
    event.preventDefault();
}

function clearSendMessage() {
    $("#sendMessageList").empty();
}

/**
 * 将 jQuery 序列化后的表单数据数组转换为对象
 *
 * @param {Array} arr
 * @return {Object}
 */
function convertFormData(arr) {
    let obj = {};
    if (!arr || !arr.length) {
        return obj;
    }
    arr.forEach(function (item) {
        if (item.value) {
            obj[item.name] = item.value;
        }
    });
    return obj;
}

/**
 * 获取订阅主题相应的颜色
 *
 * @param {String} topic - 主题
 */
function getColorForSubscription(topic) {
    for (let _topic in TOPIC_COLOR_MAP) {
        if (this.containTopic(_topic, topic)) {
            return TOPIC_COLOR_MAP[_topic];
        }
    }
}

/**
 * 判断一个主题是否包含另外一个主题
 *
 * @param {String} topic -父主题
 * @param {String} subTopic - 子主题
 */
function containTopic(topic, subTopic) {
    let pattern = topic.replace("+", "(.+?)").replace("#", "(.*)");
    let regex = new RegExp("^" + pattern + "$");
    return regex.test(subTopic);
}

function getRandomColor() {
    let r = Math.round(Math.random() * 255).toString(16);
    let g = Math.round(Math.random() * 255).toString(16);
    let b = Math.round(Math.random() * 255).toString(16);
    return r + g + b;
}

function getRandomIdName() {
    return `${Math.random().toString(36).substr(2, 5)}`;
}

/**
 * 是否是定时发送类型数据
 * 某些数据未形成成对发送时，就单独定时发
 * @param {*} name
 * @returns
 */
const defaultData = [
    "RSI_data",
    "multi_source_fusion_track",
    "complement_track",
    "ICW_track",
    "VPTC_CW_track_stright",
    "VPTC_CW_track_turn",
    "video_track",
    "radar_track",
];

function isIntervalData(name) {
    const track = Object.keys(cooperMap);
    const msg_vir = Object.values(cooperMap);
    const EXTRA_DATA = [...track, ...msg_vir, ...defaultData];

    return name.indexOf("rsm") > -1 || EXTRA_DATA.includes(name);
}

/**
 * 数据处理
 * 返回两层数组，前者是需要启用定时器发送的数据，后者是需要配对同步发送的数据
 * @param {*} _data
 * @returns {Array}
 */
function postCheckedData(_data) {
    const msg_VIR = Object.values(cooperMap);

    const filteredChecked = _data.filter(({name}) => !msg_VIR.includes(name));

    const virData = _data.filter(({name}) => msg_VIR.includes(name));

    if (virData) {
        return [filteredChecked, [virData]];
    }

    return [_data, []];
}
