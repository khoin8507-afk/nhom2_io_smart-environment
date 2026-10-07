import { 
  Outlet, 
  useNavigate, 
  useLocation 
} from 'react-router-dom'

import {
  AppBar,
  Toolbar,
  Typography,
  Button,
  Box,
  Drawer,
  List,
  ListItem,
  ListItemButton,
  ListItemIcon,
  ListItemText,
  CssBaseline,
  Avatar,
  Chip
} from '@mui/material'


import DashboardIcon from '@mui/icons-material/Dashboard'
import ListAltIcon from '@mui/icons-material/ListAlt'
import LogoutIcon from '@mui/icons-material/Logout'
import MemoryIcon from '@mui/icons-material/Memory'
import SensorsIcon from '@mui/icons-material/Sensors'


import { useAuth } from '../contexts/AuthContext'



const drawerWidth = 260



export default function Layout(){


const {
 logout,
 role,
 token
}=useAuth()


const navigate=useNavigate()

const location=useLocation()



if(!token)
 return null




const menuItems=[

{
 text:"Dashboard",
 icon:<DashboardIcon/>,
 path:"/"
},

{
 text:"Telemetry Logs",
 icon:<ListAltIcon/>,
 path:"/logs"
}

]





return(


<Box

sx={{

display:"flex",

minHeight:"100vh",

background:

"linear-gradient(135deg,#eef5ff,#f8fbff)"

}}

>


<CssBaseline/>





{/* HEADER */}


<AppBar

position="fixed"

sx={{

zIndex:(theme)=>
theme.zIndex.drawer+1,


background:

"linear-gradient(90deg,#005bea,#00c6fb)",


boxShadow:

"0 8px 25px rgba(0,0,0,.15)"

}}

>


<Toolbar>


<Box

display="flex"

alignItems="center"

gap={2}

flexGrow={1}

>


<Avatar

sx={{

background:

"rgba(255,255,255,.2)"

}}

>

<MemoryIcon/>

</Avatar>



<Box>


<Typography

variant="h6"

fontWeight="bold"

>

IoT Smart Cloud

</Typography>


<Typography

fontSize={12}

>

ESP32-S3 Monitoring Platform

</Typography>


</Box>


</Box>






<Chip

label={`ROLE : ${role}`}

sx={{

color:"#fff",

background:

"rgba(255,255,255,.2)",

fontWeight:"bold"

}}

/>




<Button

color="inherit"

onClick={logout}

startIcon={<LogoutIcon/>}

sx={{

ml:2,

fontWeight:"bold"

}}

>

Logout

</Button>



</Toolbar>


</AppBar>









{/* SIDEBAR */}


<Drawer

variant="permanent"


sx={{


width:drawerWidth,


flexShrink:0,


[`& .MuiDrawer-paper`]:{


width:drawerWidth,


boxSizing:"border-box",


border:"none",


background:

"linear-gradient(180deg,#061b3a,#092b63)",


color:"#fff",


paddingTop:"20px"

}

}}

>


<Toolbar/>




<Box

sx={{

px:2

}}

>


<Box

sx={{

display:"flex",

alignItems:"center",

gap:2,

mb:4

}}

>


<Avatar

sx={{

background:"#00c6fb"

}}

>

<SensorsIcon/>

</Avatar>



<Box>

<Typography

fontWeight="bold"

>

Smart Sensor

</Typography>


<Typography

fontSize={12}

sx={{opacity:.7}}

>

Online System

</Typography>


</Box>


</Box>






<List>


{

menuItems.map(item=>(


<ListItem

key={item.text}

disablePadding

sx={{mb:1}}

>


<ListItemButton


selected={

location.pathname===item.path

}


onClick={()=>navigate(item.path)}



sx={{


borderRadius:3,


"&.Mui-selected":{

background:

"linear-gradient(90deg,#00c6fb,#005bea)",


color:"#fff"


},



"&:hover":{

background:

"rgba(255,255,255,.15)"

}


}}



>


<ListItemIcon

sx={{

color:"inherit"

}}

>

{item.icon}

</ListItemIcon>



<ListItemText

primary={item.text}

/>



</ListItemButton>


</ListItem>


))


}


</List>


</Box>


</Drawer>











{/* CONTENT */}



<Box

component="main"

sx={{


flexGrow:1,


p:3,


mt:8,


minHeight:"100vh"


}}

>


<Outlet/>


</Box>



</Box>


)

}