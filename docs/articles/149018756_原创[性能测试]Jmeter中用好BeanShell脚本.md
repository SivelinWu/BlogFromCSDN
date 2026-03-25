# 原创[性能测试]Jmeter中用好BeanShell脚本

> 原文: https://blog.csdn.net/weixin_42390585/article/details/149018756

> *原创内容，未获授权禁止转载、转发、抄袭。

Jmeter中有一个很好用的工具——BeanShell脚本。测试时可以在前置和后置脚本中通过BeanShell来帮助获取参数，对参数做加密解密等处理，还能帮助更加灵活的做断言。  
下面分享几段实用的BeanShell供参考：
    
    //取response中JSONArray汇总不为空的familyId
    import com.alibaba.fastjson.*;
    
    vars.put("familyId","0");
    JSONArray familyList = JSONObject.parseObject(prev.getResponseDataAsString()).getJSONArray("data");
    if(familyList.size() > 0)
    {
    	for(JSONObject ele : familyList)
    	{
    		if(ele.get("familyId") != null)
    		{
    			vars.put("familyId", ele.get("familyId").toString());
    			break;
    		}
    	}
    }
    
    
    //断言list不为空（包含name子字段）
    import com.alibaba.fastjson.*;
    
    vars.put("assertResult","false");
    JSONArray dataList = JSONObject.parseObject(prev.getResponseDataAsString()).getJSONObject("data").getJSONArray("list");
    if(dataList.size() > 0)
    {
    	for(JSONObject ele : dataList)
    	{
    		if(ele.get("name") == null)
    		{
    			vars.put("assertResult","false");
    			break;
    		}
    		else
    		{
    			vars.put("assertResult","true");
    		}
    	}
    }
    else
    {
    	vars.put("assertResult","false");
    }
    
    
    //断言list不为空（包含name子字段）提取response中list的id并拼接
    import com.alibaba.fastjson.*;
    
    String orgList = "";
    vars.put("orgList","");
    vars.put("assertResult","false");
    JSONArray dataList = JSONObject.parseObject(prev.getResponseDataAsString()).getJSONArray("data");
    if(dataList.size() > 0)
    {
    	for(JSONObject ele : dataList)
    	{
    		if(ele.get("orgId") == null)
    		{
    			vars.put("assertResult","false");
    			break;
    		}
    		else
    		{
    			vars.put("assertResult","true");
    			orgList = orgList + ele.get("orgId") + ",";
    		}
    	}
    	orgList = orgList.substring(0, orgList.length() - 1);
    	vars.put("orgList",orgList);
    }
    else
    {
    	vars.put("assertResult","false");
    }
    
    
    //当响应的list中全部子项某个字段都为false，才为false
    import com.alibaba.fastjson.JSONObject;
    import com.alibaba.fastjson.JSONArray;
    
    JSONArray topRecommendList = JSONObject.parseObject(prev.getResponseDataAsString()).getJSONObject("data").getJSONArray("topRecommendList");
    
            vars.put("today_has_live", "false");
            if(topRecommendList.size() > 0){
                String skuId = "0";
                String time = topRecommendList.getJSONObject(0).getString("beginTime");
                if(time.contains(vars.get("time"))){
                    skuId = topRecommendList.getJSONObject(0).getString("skuId");
                    vars.put("today_has_live", "true");
                }
                vars.put("skuId", skuId);
            }
    
    
    //获取查询入参开始时间和结束时间，查询范围近30天
    import java.time.LocalDate;
    import java.time.LocalDateTime;
    
    String EndDay= LocalDate.now().toString();
    String StartDay = LocalDate.now().minusDays(30).toString();
    vars.put("StartDay",StartDay);
    vars.put("EndDay",EndDay);
    
    
    //beanshell查数据库
    import java.sql.*;
    
    String url = "jdbc:mysql://test-mysql.XXXX.com:3306/wmtjr_zfpt";
    String user = "test_user";
    String password = "Mnd66xnyed";
    
    String sql = "SELECT * FROM `tjr_zfpt`.`tp_order` WHERE `pay_order_no` = 'ghzf29582981763079645' LIMIT 0,1000";
    
    String queryResult = "";
    Connection conn = null;
    Statement stmt = null;
    ResultSet rs = null;
    resultList = new ArrayList();
    
    Class.forName("com.mysql.jdbc.Driver");
    conn = DriverManager.getConnection(url, user, password);
    stmt = conn.createStatement();
    rs = stmt.executeQuery(sql);
    
    ResultSetMetaData metaData = rs.getMetaData();
    int columnCount = metaData.getColumnCount();
    
    while (rs.next()) {
        row = new HashMap();
        for (int i = 1; i <= columnCount; i++) {
            columnName = metaData.getColumnLabel(i);
            row.put(columnName, rs.getObject(i));
        }
        resultList.add(row);
    }
    vars.put("res", resultList.toString());
    
    if (rs != null) {
        rs.close();
        if (stmt != null) {
            stmt.close();
        }
        if (conn != null) {
            conn.close();
        }
    }
    
    
    //beanshell读取redis
    import redis.clients.jedis.Jedis;
    
    String redisHost = "192.168.1.193";
    int redisPort = 6383;
    String pwd = "sldfjWRJF38yd";
    String redisKey = "${SessionId}";
    int dbIndex = 1;
    
    Jedis jedis = new Jedis(redisHost, redisPort);
    rs = jedis.auth(pwd);
    String selectResponse = jedis.select(dbIndex);
    String value = jedis.get(redisKey);
    vars.put("res", value);
    if (jedis != null) {
        jedis.close();
    }
    
    
    //登录密码RSA加密
    import java.math.BigInteger;
    import java.util.ArrayList;
    import java.util.Collections;
    
    String password = "ceshi202501@A";
    String modulusHex = vars.get("modulus");
    String exponentHex = vars.get("exponent");
    
    int hexLen = modulusHex.length();
    int numDigits = (hexLen + 3) / 4;
    int[] modDigits = new int[numDigits];
    int pos = hexLen;
    for (int j = 0; pos > 0; j++) {
        int start = pos - 4;
        if (start < 0) {
            start = 0;
        }
        String part = modulusHex.substring(start, pos);
        modDigits[j] = Integer.parseInt(part, 16);
        pos -= 4;
    }
    int highIndex = numDigits - 1;
    while (highIndex > 0 && modDigits[highIndex] == 0) {
        highIndex--;
    }
    int chunkSize = 2 * highIndex;
    
    BigInteger modulus = new BigInteger(modulusHex, 16);
    BigInteger exponent = new BigInteger(exponentHex, 16);
    
    byte[] plainBytes = password.getBytes("ISO-8859-1");
    
    int paddedLen = ((plainBytes.length + chunkSize - 1) / chunkSize) * chunkSize;
    byte[] padded = new byte[paddedLen];
    System.arraycopy(plainBytes, 0, padded, 0, plainBytes.length);
    
    StringBuffer resultBuilder = new StringBuffer();
    BigInteger twoByteRadix = BigInteger.valueOf(65536);
    
    
    for (int i = 0; i < paddedLen; i += chunkSize) {
        int numGroup = chunkSize / 2;
        BigInteger block = BigInteger.ZERO;
        BigInteger multiplier = BigInteger.ONE;
        for (int j = 0; j < numGroup; j++) {
            int index = i + j * 2;
            int low = padded[index] & 0xff;
            int high = padded[index + 1] & 0xff;
            int value = low + (high << 8);
            block = block.add(BigInteger.valueOf(value).multiply(multiplier));
            multiplier = multiplier.multiply(twoByteRadix);
        }
        BigInteger crypt = block.modPow(exponent, modulus);
    
        ArrayList hexDigits = new ArrayList();
        BigInteger temp = crypt;
        if (temp.equals(BigInteger.ZERO)) {
            hexDigits.add("0000");
        } else {
            while (temp.compareTo(BigInteger.ZERO) > 0) {
                BigInteger[] dr = temp.divideAndRemainder(twoByteRadix);
                int d = dr[1].intValue();
                String hex = Integer.toHexString(d);
                while (hex.length() < 4) {
                    hex = "0" + hex;
                }
                hexDigits.add(hex);
                temp = dr[0];
            }
        }
        Collections.reverse(hexDigits);
        StringBuffer blockHex = new StringBuffer();
        for (int k = 0; k < hexDigits.size(); k++) {
            blockHex.append((String) hexDigits.get(k));
        }
        resultBuilder.append(blockHex.toString());
        resultBuilder.append(" ");
    }
    
    String encrypted = resultBuilder.toString().trim();
    vars.put("encryptedPassword", encrypted);
    
    
    //对字符串作base64加密
    import org.apache.commons.codec.binary.Base64;
    byte[] decodedBytes = Base64.decodeBase64("your string}");
    String redisKey = new String(decodedBytes, "UTF-8");
    
